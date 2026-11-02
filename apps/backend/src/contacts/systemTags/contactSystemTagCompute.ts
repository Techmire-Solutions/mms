import { and, eq, inArray, or } from "drizzle-orm";
import {
  CONTACT_SYSTEM_TAG_KEYS,
  CONTACT_SYSTEM_TAG_LABELS,
  CONTACT_TAG_SOURCE_STUDENT,
  formatArchivedSystemTag,
  normalizeRelationshipTerm,
  systemTagBaseName,
  type ContactTagSource,
} from "@mms/shared";
import { contactRelationships, students } from "../../db/schema.js";
import type { TenantTransaction } from "../../db/tenant-context.js";

const RECONCILE_BATCH_SIZE = 500;
const ACTIVE_STUDENT_STATUSES = new Set(["active", "suspended"]);
export const ACTIVE_EMPLOYMENT_STATUSES = new Set(["active", "on_leave"]);

export interface DesiredSystemTag {
  name: string;
  source: ContactTagSource;
  systemKey: string;
  archived: boolean;
}

export function chunk<T>(items: T[], size = RECONCILE_BATCH_SIZE): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

export function isActiveWindow(
  startDate: string | null,
  endDate: string | null,
  today: string,
): boolean {
  if (startDate && startDate > today) return false;
  return !endDate || endDate >= today;
}

export function addDesired(
  map: Map<string, DesiredSystemTag>,
  tag: DesiredSystemTag,
  archived: boolean,
): void {
  const key = tag.systemKey;
  const existing = map.get(key);
  // Active always wins over archived when any source is still active.
  if (existing && !existing.archived) return;
  const baseName = systemTagBaseName(tag.name);
  map.set(key, {
    ...tag,
    name: archived ? formatArchivedSystemTag(baseName) : baseName,
    archived,
  });
}

/** Student module roles: Student (own contact), Parent, Guardian.
 *
 * Guardians live on the student's primary contact relationship graph (the
 * domain deliberately does not dual-write `students.father/mother/guardian`
 * columns). Legacy columns are still honoured when present.
 */
export async function computeStudentDesiredTags(
  tx: TenantTransaction,
  subdomain: string,
  contactIds: string[],
): Promise<Map<string, Map<string, DesiredSystemTag>>> {
  const perContact = new Map<string, Map<string, DesiredSystemTag>>();
  const candidateIds = new Set(contactIds);

  const add = (contactId: string | null, key: string, label: string, active: boolean): void => {
    if (!contactId || !candidateIds.has(contactId)) return;
    const tags = perContact.get(contactId) ?? new Map<string, DesiredSystemTag>();
    addDesired(
      tags,
      {
        name: active ? label : formatArchivedSystemTag(label),
        source: CONTACT_TAG_SOURCE_STUDENT,
        systemKey: key,
        archived: false,
      },
      !active,
    );
    perContact.set(contactId, tags);
  };

  const selfRows = (await tx
    .select({
      contactId: students.contactId,
      fatherContactId: students.fatherContactId,
      motherContactId: students.motherContactId,
      guardianContactId: students.guardianContactId,
      status: students.status,
      deletedAt: students.deletedAt,
    })
    .from(students)
    .where(
      and(
        eq(students.workspaceSubdomain, subdomain),
        or(
          inArray(students.contactId, contactIds),
          inArray(students.fatherContactId, contactIds),
          inArray(students.motherContactId, contactIds),
          inArray(students.guardianContactId, contactIds),
        ),
      ),
    )) as Array<{
    contactId: string | null;
    fatherContactId: string | null;
    motherContactId: string | null;
    guardianContactId: string | null;
    status: string | null;
    deletedAt: Date | null;
  }>;

  for (const row of selfRows) {
    const active = row.deletedAt == null && ACTIVE_STUDENT_STATUSES.has(row.status ?? "");
    add(
      row.contactId,
      CONTACT_SYSTEM_TAG_KEYS.studentSelf,
      CONTACT_SYSTEM_TAG_LABELS.studentSelf,
      active,
    );
    add(
      row.fatherContactId,
      CONTACT_SYSTEM_TAG_KEYS.studentParent,
      CONTACT_SYSTEM_TAG_LABELS.studentParent,
      active,
    );
    add(
      row.motherContactId,
      CONTACT_SYSTEM_TAG_KEYS.studentParent,
      CONTACT_SYSTEM_TAG_LABELS.studentParent,
      active,
    );
    add(
      row.guardianContactId,
      CONTACT_SYSTEM_TAG_KEYS.studentGuardian,
      CONTACT_SYSTEM_TAG_LABELS.studentGuardian,
      active,
    );
  }

  // Relationship-graph links: candidate contact ← student primary contact.
  const linkRows = (await tx
    .select({
      relatedContactId: contactRelationships.relatedContactId,
      relationship: contactRelationships.relationship,
      studentStatus: students.status,
      studentDeletedAt: students.deletedAt,
    })
    .from(contactRelationships)
    .innerJoin(
      students,
      and(
        eq(students.workspaceSubdomain, subdomain),
        eq(students.contactId, contactRelationships.contactId),
      ),
    )
    .where(
      and(
        eq(contactRelationships.workspaceSubdomain, subdomain),
        inArray(contactRelationships.relatedContactId, contactIds),
      ),
    )) as Array<{
    relatedContactId: string | null;
    relationship: string | null;
    studentStatus: string | null;
    studentDeletedAt: Date | null;
  }>;

  for (const row of linkRows) {
    const term = normalizeRelationshipTerm(row.relationship ?? "");
    if (term !== "parent" && term !== "guardian") continue;
    const active =
      row.studentDeletedAt == null && ACTIVE_STUDENT_STATUSES.has(row.studentStatus ?? "");
    add(
      row.relatedContactId,
      term === "parent"
        ? CONTACT_SYSTEM_TAG_KEYS.studentParent
        : CONTACT_SYSTEM_TAG_KEYS.studentGuardian,
      term === "parent"
        ? CONTACT_SYSTEM_TAG_LABELS.studentParent
        : CONTACT_SYSTEM_TAG_LABELS.studentGuardian,
      active,
    );
  }

  return perContact;
}
