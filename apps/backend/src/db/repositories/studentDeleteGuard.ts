import { sql } from "drizzle-orm";
import { withTenantRead } from "../tenant-context.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { facultyEmployments, financeInvoices, students, tenantUsers } from "../schema.js";

/**
 * Pre-deletion guard for students.
 * Blocks soft-delete with 409 Conflict if active dependent operational records
 * (e.g. active unpaid invoices) are still associated with the target students.
 */
export async function guardStudentSoftDelete(tenant: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const subdomain = tenant.trim().toLowerCase();
  await withTenantRead(subdomain, async (tx) => {
    if (!tx || typeof (tx as { execute?: unknown }).execute !== "function") return;
    const members = sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    );
    const unpaidInvoices = await tx.execute(sql`
      SELECT 1
      FROM ${financeInvoices} fi
      WHERE fi.workspace_subdomain = ${subdomain}
        AND fi.student_id IN (${members})
        AND fi.deleted_at IS NULL
        AND fi.status NOT IN ('paid', 'void', 'cancelled')
      LIMIT 1
    `);
    if (unpaidInvoices.rows.length > 0) {
      throw new ConflictError(
        "Cannot delete student with active unpaid invoices. Settle or cancel invoices first.",
      );
    }
  });
}

const DEPENDENT_LINK_MESSAGES = {
  student:
    "Cannot delete contact linked to active student profiles. Archive or reassign student profiles first.",
  faculty:
    "Cannot delete contact linked to an active faculty employment. Remove or reassign the employment first.",
  user: "Cannot delete contact linked to an active staff user. Unlink or reassign the user first.",
} as const;

type DependentLinkKind = keyof typeof DEPENDENT_LINK_MESSAGES;

/**
 * Pre-deletion guard for contacts that still back an active person record.
 *
 * Covers every link the module reparents on merge — student profile columns,
 * faculty employments and tenant users — so archiving a contact can never leave
 * an active student/staff row pointing at a soft-deleted contact
 * (`mms-data-layer` §6.8: active foreign keys block the write with 409).
 */
export async function guardContactSoftDeleteDependents(
  tenant: string,
  contactIds: string[],
): Promise<void> {
  if (!contactIds.length) return;
  const subdomain = tenant.trim().toLowerCase();
  await withTenantRead(subdomain, async (tx) => {
    if (!tx || typeof (tx as { execute?: unknown }).execute !== "function") return;
    const members = sql.join(
      contactIds.map((id) => sql`${id}`),
      sql`, `,
    );
    const blocking = await tx.execute(sql`
      SELECT 'student' AS kind
      FROM ${students} s
      WHERE s.workspace_subdomain = ${subdomain}
        AND (
          s.contact_id IN (${members})
          OR s.father_contact_id IN (${members})
          OR s.mother_contact_id IN (${members})
          OR s.guardian_contact_id IN (${members})
        )
        AND s.deleted_at IS NULL
      LIMIT 1
    `);
    if (blocking.rows.length > 0) {
      throw new ConflictError(DEPENDENT_LINK_MESSAGES.student);
    }

    const linkedEmployment = await tx.execute(sql`
      SELECT 1
      FROM ${facultyEmployments} fe
      WHERE fe.workspace_subdomain = ${subdomain}
        AND fe.contact_id IN (${members})
        AND fe.deleted_at IS NULL
      LIMIT 1
    `);
    if (linkedEmployment.rows.length > 0) {
      throw new ConflictError(DEPENDENT_LINK_MESSAGES.faculty);
    }

    const linkedUser = await tx.execute(sql`
      SELECT 1
      FROM ${tenantUsers} tu
      WHERE tu.workspace_subdomain = ${subdomain}
        AND tu.contact_id IN (${members})
        AND tu.deleted_at IS NULL
      LIMIT 1
    `);
    if (linkedUser.rows.length > 0) {
      throw new ConflictError(DEPENDENT_LINK_MESSAGES.user);
    }
  });
}

export type { DependentLinkKind };
