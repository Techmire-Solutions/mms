/**
 * @file facultyRepositoryListContactOps.ts
 * @description Faculty contact-link probes via faculty_employments SSOT.
 */
import { and, eq, isNotNull, isNull, ne, sql, type SQL } from "drizzle-orm";
import type { FacultyMember } from "@mms/shared";
import { faculty, facultyEmployments } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { FACULTY_PROJECTION_COLUMNS, facultyRowToRecord } from "./facultyRepositoryColumns.js";

function activeEmploymentJoin(subdomain: string): SQL {
  return and(
    eq(faculty.workspaceSubdomain, facultyEmployments.workspaceSubdomain),
    eq(faculty.employmentId, facultyEmployments.id),
    eq(facultyEmployments.workspaceSubdomain, subdomain),
    isNull(facultyEmployments.deletedAt),
  )!;
}

/** Distinct linked contact ids for active faculty (via employment.contact_id). */
export async function listFacultyLinkedContactIdsSql(
  tenant: string,
  excludeFacultyId?: string,
): Promise<Array<string | number>> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const conditions: SQL[] = [
      eq(faculty.workspaceSubdomain, subdomain),
      isNull(faculty.deletedAt),
      isNotNull(facultyEmployments.contactId),
      sql`NULLIF(trim(${facultyEmployments.contactId}), '') IS NOT NULL`,
    ];
    if (excludeFacultyId?.trim()) {
      conditions.push(ne(faculty.id, excludeFacultyId.trim()));
    }
    const rows = await tx
      .select({ contactId: facultyEmployments.contactId })
      .from(faculty)
      .innerJoin(facultyEmployments, activeEmploymentJoin(subdomain))
      .where(and(...conditions));
    return rows.map((row) => row.contactId).filter((id): id is string => Boolean(id && id.trim()));
  });
}

/**
 * Finds a soft-deleted faculty whose employment `contact_id` matches (re-registration
 * restore-on-create probe). Only deleted faculty rows are candidates.
 */
export async function findSoftDeletedFacultyByContactIdSql(
  tenant: string,
  contactId: string,
): Promise<FacultyMember | null> {
  const subdomain = tenant.trim().toLowerCase();
  const trimmedContactId = contactId.trim();
  if (!trimmedContactId) return null;
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(FACULTY_PROJECTION_COLUMNS)
      .from(faculty)
      .innerJoin(
        facultyEmployments,
        and(
          eq(faculty.workspaceSubdomain, facultyEmployments.workspaceSubdomain),
          eq(faculty.employmentId, facultyEmployments.id),
        ),
      )
      .where(
        and(
          eq(faculty.workspaceSubdomain, subdomain),
          eq(facultyEmployments.contactId, trimmedContactId),
          isNotNull(faculty.deletedAt),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? facultyRowToRecord(row) : null;
  });
}

/**
 * Probes for an active faculty already linked to the same contact or using the
 * same employee id (server-authoritative duplicate check on save).
 */
export async function findFacultyRegistrationConflictSql(
  tenant: string,
  input: {
    excludeId?: string;
    contactId?: string | number;
    employeeId?: string;
  },
): Promise<"contact" | "employeeId" | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const exclude = input.excludeId?.trim();
    const baseConditions: SQL[] = [
      eq(faculty.workspaceSubdomain, subdomain),
      isNull(faculty.deletedAt),
    ];
    if (exclude) baseConditions.push(ne(faculty.id, exclude));

    if (input.contactId != null && String(input.contactId).trim() !== "") {
      const contactId = String(input.contactId).trim();
      const rows = await tx
        .select({ id: faculty.id })
        .from(faculty)
        .innerJoin(facultyEmployments, activeEmploymentJoin(subdomain))
        .where(and(...baseConditions, eq(facultyEmployments.contactId, contactId)))
        .limit(1);
      if (rows.length > 0) return "contact";
    }

    const employeeId = input.employeeId?.trim().toLowerCase();
    if (employeeId) {
      const rows = await tx
        .select({ id: faculty.id })
        .from(faculty)
        .innerJoin(facultyEmployments, activeEmploymentJoin(subdomain))
        .where(
          and(
            ...baseConditions,
            sql`lower(trim(COALESCE(${facultyEmployments.employeeId}, ''))) = ${employeeId}`,
          ),
        )
        .limit(1);
      if (rows.length > 0) return "employeeId";
    }

    return null;
  });
}
