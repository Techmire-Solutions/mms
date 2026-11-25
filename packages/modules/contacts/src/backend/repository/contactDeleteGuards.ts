import { sql, type SQL } from "drizzle-orm";
import { withTenantRead } from "@mms/db/context";
import { ConflictError } from "@mms/be-core/http/errors";
import {
  facultyEmployments,
  students,
  tenantUsers,
  workshopEvents,
  workshopParticipants,
} from "@mms/db/schema";

const DEPENDENT_LINK_MESSAGES = {
  student:
    "Cannot delete contact linked to active student profiles. Archive or reassign student profiles first.",
  faculty:
    "Cannot delete contact linked to an active faculty employment. Remove or reassign the employment first.",
  user: "Cannot delete contact linked to an active staff user. Unlink or reassign the user first.",
  workshop:
    "Cannot delete contact registered for an active workshop. Withdraw the registration first.",
} as const;

export type DependentLinkKind = keyof typeof DEPENDENT_LINK_MESSAGES;

/** One contact that cannot be archived yet, with the first active link that blocks it. */
export interface ContactDeleteBlocker {
  contactId: string;
  kind: DependentLinkKind;
  message: string;
}

const BLOCKER_KIND_ORDER: readonly DependentLinkKind[] = ["student", "faculty", "user", "workshop"];

/**
 * Contacts in `contactIds` that still back an active person record, one entry per
 * contact (first blocking kind in {@link BLOCKER_KIND_ORDER}).
 *
 * Covers every link the module reparents on merge — student profile columns,
 * faculty employments and tenant users — plus active workshop registrations, so
 * archiving a contact can never leave an active row pointing at a soft-deleted
 * contact (`mms-data-layer` §6.8: active foreign keys block the write).
 */
export async function findContactDeleteBlockers(
  tenant: string,
  contactIds: string[],
): Promise<ContactDeleteBlocker[]> {
  if (!contactIds.length) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    if (!tx || typeof (tx as { execute?: unknown }).execute !== "function") return [];
    const members = sql.join(
      contactIds.map((id) => sql`${id}`),
      sql`, `,
    );
    const queries: Record<DependentLinkKind, SQL> = {
      student: sql`
        SELECT DISTINCT link.contact_id
        FROM ${students} s
        CROSS JOIN LATERAL (VALUES
          (s.contact_id), (s.father_contact_id), (s.mother_contact_id), (s.guardian_contact_id)
        ) AS link(contact_id)
        WHERE s.workspace_subdomain = ${subdomain}
          AND s.deleted_at IS NULL
          AND link.contact_id IN (${members})
      `,
      faculty: sql`
        SELECT DISTINCT fe.contact_id
        FROM ${facultyEmployments} fe
        WHERE fe.workspace_subdomain = ${subdomain}
          AND fe.contact_id IN (${members})
          AND fe.deleted_at IS NULL
      `,
      user: sql`
        SELECT DISTINCT tu.contact_id
        FROM ${tenantUsers} tu
        WHERE tu.workspace_subdomain = ${subdomain}
          AND tu.contact_id IN (${members})
          AND tu.deleted_at IS NULL
      `,
      workshop: sql`
        SELECT DISTINCT wp.contact_id
        FROM ${workshopParticipants} wp
        JOIN ${workshopEvents} we
          ON we.workspace_subdomain = wp.workspace_subdomain
         AND we.id = wp.workshop_id
        WHERE wp.workspace_subdomain = ${subdomain}
          AND wp.contact_id IN (${members})
          AND wp.deleted_at IS NULL
          AND we.deleted_at IS NULL
      `,
    };

    const blockers: ContactDeleteBlocker[] = [];
    const seen = new Set<string>();
    for (const kind of BLOCKER_KIND_ORDER) {
      const result = await tx.execute(queries[kind]);
      for (const row of result.rows as Array<{ contact_id?: unknown }>) {
        const contactId = String(row.contact_id ?? "");
        if (seen.has(contactId)) continue;
        seen.add(contactId);
        blockers.push({ contactId, kind, message: DEPENDENT_LINK_MESSAGES[kind] });
      }
    }
    return blockers;
  });
}

/**
 * Pre-deletion guard for contacts that still back an active person record:
 * throws 409 with the first blocking link (see {@link findContactDeleteBlockers}).
 */
export async function guardContactSoftDeleteDependents(
  tenant: string,
  contactIds: string[],
): Promise<void> {
  const [first] = await findContactDeleteBlockers(tenant, contactIds);
  if (first) throw new ConflictError(first.message);
}
