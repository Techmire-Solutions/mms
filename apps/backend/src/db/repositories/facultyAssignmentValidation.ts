import { sql } from "drizzle-orm";
import type { TenantTransaction } from "../tenant-context.js";
import type { InsertFacultyAssignmentRow } from "../schema/facultyAssignmentTables.js";

export async function lockFacultyHierarchy(
  tx: Pick<TenantTransaction, "execute">,
  tenant: string,
): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`faculty:${tenant}`}, 0))`);
}

export async function validateFacultyAssignment(
  tx: Pick<TenantTransaction, "execute">,
  tenant: string,
  input: InsertFacultyAssignmentRow,
): Promise<void> {
  await lockFacultyHierarchy(tx, tenant);
  const existing = await tx.execute<{ faculty_id: string; deleted_at: Date | null }>(sql`
    SELECT faculty_id, deleted_at FROM faculty_assignments
    WHERE workspace_subdomain = ${tenant} AND id = ${input.id} FOR UPDATE
  `);
  if (existing.rows.some((row) => row.faculty_id !== input.facultyId || row.deleted_at !== null)) {
    throw new Error("Assignment is archived or belongs to another faculty member");
  }
  const member = await tx.execute(sql`
    SELECT id FROM faculty WHERE workspace_subdomain = ${tenant}
      AND id = ${input.facultyId} AND deleted_at IS NULL FOR UPDATE
  `);
  const department = await tx.execute(sql`
    SELECT id FROM faculty_departments WHERE workspace_subdomain = ${tenant}
      AND id = ${input.departmentId} AND deleted_at IS NULL AND status = 'active' FOR SHARE
  `);
  const designation = await tx.execute(sql`
    SELECT id FROM faculty_designations WHERE workspace_subdomain = ${tenant}
      AND id = ${input.designationId} AND deleted_at IS NULL AND status = 'active' FOR SHARE
  `);
  if (!member.rows.length || !department.rows.length || !designation.rows.length) {
    throw new Error("Faculty, department and designation must be active in this workspace");
  }
  if (input.endDate && input.endDate < input.startDate)
    throw new Error("End date precedes start date");
  if (input.isPrimary) {
    const overlaps = await tx.execute(sql`
      SELECT id FROM faculty_assignments WHERE workspace_subdomain = ${tenant}
        AND faculty_id = ${input.facultyId} AND id <> ${input.id} AND deleted_at IS NULL AND is_primary
        AND start_date <= COALESCE(${input.endDate ?? null}::date, 'infinity'::date)
        AND COALESCE(end_date, 'infinity'::date) >= ${input.startDate}::date LIMIT 1
    `);
    if (overlaps.rows.length)
      throw new Error("Primary assignment overlaps an existing appointment");
  }
}
