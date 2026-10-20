import { and, eq, isNotNull, isNull, ne, sql, type SQL } from "drizzle-orm";
import { students, contacts, contactEmails } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { studentRowToRecord } from "./studentRepositoryMappers.js";
import { enableIncludeDeleted } from "../../lib/softDeleteHelpers.js";
import { STUDENT_COLUMNS } from "./studentRepositoryColumns.js";

export async function listStudentLinkedContactIdsSql(
  tenant: string,
  excludeStudentId?: string,
): Promise<Array<string | number>> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const conditions: SQL[] = [
      eq(students.workspaceSubdomain, subdomain),
      isNull(students.deletedAt),
    ];
    if (excludeStudentId?.trim()) {
      conditions.push(ne(students.id, excludeStudentId.trim()));
    }
    const rows = await tx
      .select({
        contactId: students.contactId,
      })
      .from(students)
      .where(and(...conditions));
    return rows.map((row) => row.contactId).filter((id): id is string => Boolean(id && id.trim()));
  });
}

export async function countStudentsForNextGrNumber(
  tenant: string,
  regDate: string,
  restartAnnually: boolean,
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  const parsedYear = regDate ? new Date(regDate).getFullYear() : NaN;
  const year = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
  return withTenantRead(subdomain, async (tx) => {
    await enableIncludeDeleted(tx);
    const base = eq(students.workspaceSubdomain, subdomain);
    if (!restartAnnually) {
      const rows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(students)
        .where(base);
      return Number(rows[0]?.count ?? 0);
    }
    const yearStr = String(year);
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(students)
      .where(
        and(
          base,
          sql`(
            COALESCE(${students.registeredDate}::text, '') LIKE ${`${yearStr}%`}
            OR COALESCE(${students.grNumber}, '') LIKE ${`%${yearStr}%`}
          )`,
        ),
      );
    return Number(rows[0]?.count ?? 0);
  });
}

export async function findStudentRegistrationConflictSql(
  tenant: string,
  input: {
    excludeId?: string;
    contactId?: string | number;
    email?: string;
    name?: string;
    dob?: string;
    grNumber?: string;
  },
): Promise<"contact" | "email" | "nameDob" | "grNumber" | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const exclude = input.excludeId?.trim();
    const baseConditions: SQL[] = [
      eq(students.workspaceSubdomain, subdomain),
      isNull(students.deletedAt),
    ];
    if (exclude) baseConditions.push(ne(students.id, exclude));

    if (input.contactId != null && String(input.contactId).trim() !== "") {
      const contactId = String(input.contactId).trim();
      const rows = await tx
        .select({ id: students.id })
        .from(students)
        .where(and(...baseConditions, eq(students.contactId, contactId)))
        .limit(1);
      if (rows.length > 0) return "contact";
    }

    const email = input.email?.trim().toLowerCase();
    if (email) {
      const rows = await tx
        .select({ id: students.id })
        .from(students)
        .where(
          and(
            ...baseConditions,
            sql`EXISTS (
              SELECT 1 FROM ${contactEmails} ce
              WHERE ce.workspace_subdomain = ${students.workspaceSubdomain}
                AND ce.contact_id = ${students.contactId}
                AND lower(trim(COALESCE(ce.address, ''))) = ${email}
            )`,
          ),
        )
        .limit(1);
      if (rows.length > 0) return "email";
    }

    const grNumber = input.grNumber?.trim().toLowerCase();
    if (grNumber) {
      const rows = await tx
        .select({ id: students.id })
        .from(students)
        .where(
          and(
            ...baseConditions,
            isNotNull(students.grNumber),
            sql`lower(btrim(${students.grNumber})) = ${grNumber}`,
          ),
        )
        .limit(1);
      if (rows.length > 0) return "grNumber";
    }

    const name = input.name?.trim().toLowerCase();
    const dob = input.dob?.trim();
    if (name && dob) {
      const rows = await tx
        .select({ id: students.id })
        .from(students)
        .where(
          and(
            ...baseConditions,
            sql`EXISTS (
              SELECT 1 FROM ${contacts} c
              WHERE c.workspace_subdomain = ${students.workspaceSubdomain}
                AND c.id = ${students.contactId}
                AND (
                  lower(trim(COALESCE(c.name, ''))) = ${name}
                  OR lower(trim(concat_ws(' ', c.first_name, c.last_name))) = ${name}
                )
                AND c.dob::text = ${dob}
            )`,
          ),
        )
        .limit(1);
      if (rows.length > 0) return "nameDob";
    }

    return null;
  });
}

/**
 * Finds a soft-deleted student whose `contact_id` matches (re-registration
 * restore-on-create probe). Only deleted rows are candidates so an active
 * duplicate is never accidentally restored.
 */
export async function findSoftDeletedStudentByContactIdSql(
  tenant: string,
  contactId: string,
): Promise<ReturnType<typeof studentRowToRecord> | null> {
  const subdomain = tenant.trim().toLowerCase();
  const trimmedContactId = contactId.trim();
  if (!trimmedContactId) return null;
  return withTenantRead(subdomain, async (tx) => {
    await enableIncludeDeleted(tx);
    const rows = await tx
      .select(STUDENT_COLUMNS)
      .from(students)
      .where(
        and(
          eq(students.workspaceSubdomain, subdomain),
          eq(students.contactId, trimmedContactId),
          isNotNull(students.deletedAt),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? studentRowToRecord(row) : null;
  });
}
