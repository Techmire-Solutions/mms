import {
  createContactLookupMap,
  hydrateContactProfile,
  hydrateParentContactNames,
  lookupContact,
  normalizeContactLinkedRecord,
  stripRecordFields,
  type ContactLike,
} from "./contactLinkPolicy.js";
import {
  resolveStudentGuardianLinks,
  type ContactWithRelationships,
} from "./studentGuardianFromContacts.js";
import type { Student } from "./studentTypes.js";

export {
  STUDENT_CLIENT_SOFT_DELETE_KEYS,
  stripStudentClientSoftDeleteFields,
  stripClientSoftDeleteFields,
  isEntityDeleted,
  filterActiveEntities,
  isStudentDeleted,
  filterActiveStudents,
} from "./studentSoftDelete.js";

import { stripStudentClientSoftDeleteFields } from "./studentSoftDelete.js";

export const STUDENT_GUARDIAN_LINK_FIELDS = [
  "fatherContactId",
  "motherContactId",
  "guardianContactId",
  "fatherName",
  "motherName",
  "guardianName",
] as const;

function stripStudentGuardianLinkFields<T extends Record<string, unknown>>(record: T): T {
  return stripRecordFields(record, STUDENT_GUARDIAN_LINK_FIELDS);
}

/** Strips contact-owned fields and client soft-delete metadata before persisting a student row. */
export function normalizeStoredStudent<T extends Record<string, unknown>>(record: T): T {
  let normalizedStudent = stripStudentClientSoftDeleteFields(record);
  normalizedStudent = normalizeContactLinkedRecord(normalizedStudent);
  // Guardians live on the primary contact's relationship graph — do not dual-write ids/names.
  return stripStudentGuardianLinkFields(normalizedStudent);
}

export type { ContactWithRelationships };
export { createContactLookupMap };

/** Hydrates student + parent display fields from contacts (relationships preferred). */
export function hydrateStudentFromContacts<T extends Student>(
  student: T,
  contacts: ContactLike[] | Map<string, ContactLike>,
): T {
  const contactLookup =
    contacts instanceof Map
      ? contacts
      : Array.isArray(contacts) && contacts.length > 8
        ? createContactLookupMap(contacts)
        : contacts;
  const primary = lookupContact(contactLookup, student.contactId);
  const guardians = resolveStudentGuardianLinks(
    student,
    (primary as ContactWithRelationships) ?? null,
  );
  const withGuardians = {
    ...student,
    fatherContactId: guardians.fatherContactId,
    motherContactId: guardians.motherContactId,
    guardianContactId: guardians.guardianContactId,
    fatherName: guardians.fatherName,
    motherName: guardians.motherName,
    guardianName: guardians.guardianName,
  } as T;

  return hydrateParentContactNames(
    hydrateContactProfile(withGuardians, contactLookup),
    contactLookup,
  ) as T;
}

/** Batch hydrates students + parent display fields from contacts with O(1) indexed lookup. */
export function hydrateStudentListFromContacts<T extends Student>(
  students: T[],
  contacts: ContactLike[] | Map<string, ContactLike>,
): T[] {
  if (!Array.isArray(students) || students.length === 0) return [];
  const contactLookup = contacts instanceof Map ? contacts : createContactLookupMap(contacts);
  return students.map((student) => hydrateStudentFromContacts(student, contactLookup));
}

export interface StudentNameParentLabels {
  father?: string;
  mother?: string;
  guardian?: string;
  separator?: string;
}

/**
 * Composes a student display title including father and mother names.
 * Format: "Student Name (Father: Father Name, Mother: Mother Name)" or fallback variants.
 *
 * @param student - Student object or partial shape containing name and parentage
 * @param labels - Optional localized labels for Father, Mother, Guardian, and separator
 * @returns Composed display name string
 */
export function formatStudentNameWithParents(
  student?: {
    name?: string | null;
    fatherName?: string | null;
    motherName?: string | null;
    guardianName?: string | null;
  } | null,
  labels?: StudentNameParentLabels,
): string {
  if (!student) return "";

  const name = (student.name || "").trim();
  const father = (student.fatherName || "").trim();
  const mother = (student.motherName || "").trim();
  const guardian = (student.guardianName || "").trim();

  const fatherLabel = labels?.father || "Father";
  const motherLabel = labels?.mother || "Mother";
  const guardianLabel = labels?.guardian || "Guardian";
  const separator = labels?.separator ?? ", ";

  const parts: string[] = [];
  if (father) {
    parts.push(`${fatherLabel}: ${father}`);
  }
  if (mother) {
    parts.push(`${motherLabel}: ${mother}`);
  }
  if (!father && !mother && guardian) {
    parts.push(`${guardianLabel}: ${guardian}`);
  }

  if (parts.length === 0) {
    return name;
  }

  return name ? `${name} (${parts.join(separator)})` : `(${parts.join(separator)})`;
}
