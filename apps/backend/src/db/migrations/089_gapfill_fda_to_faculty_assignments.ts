import { sql } from "drizzle-orm";
import { withGlobalTenant, withTenant } from "../tenant-context.js";
import { lockFacultyHierarchy } from "../repositories/facultyAssignmentValidation.js";

/**
 * Migration 089: Gap-fill open faculty_designation_assignments into primary
 * faculty_assignments when a faculty member has no active FA row yet.
 *
 * Prefer attaching position_id when a matching org position exists for the
 * (department, designation) pair. Legacy null position_id is allowed on this
 * backfill path (creates require positionId via app validation only).
 */
export async function runMigration089(): Promise<void> {
  const tenants = await withGlobalTenant(async (tx) => {
    const tableExists = (
      await tx.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'faculty_designation_assignments'
      ) AS exists
    `)
    ).rows[0]?.exists;
    if (!tableExists) return [];

    return (
      await tx.execute<{ workspace_subdomain: string }>(sql`
      SELECT DISTINCT workspace_subdomain FROM faculty_designation_assignments
      ORDER BY workspace_subdomain
    `)
    ).rows;
  });
  for (const { workspace_subdomain: tenant } of tenants) {
    await gapfillFdaToFacultyAssignments(tenant);
  }
}

export async function gapfillFdaToFacultyAssignments(tenant: string): Promise<void> {
  await withTenant(tenant, async (tx) => {
    const tableExists = (
      await tx.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'faculty_designation_assignments'
      ) AS exists
    `)
    ).rows[0]?.exists;
    if (!tableExists) return;

    await lockFacultyHierarchy(tx, tenant);
    // Open FDA rows (no end, or end >= today) with no overlapping active primary FA.
    await tx.execute(sql`
      INSERT INTO faculty_assignments (
        id, workspace_subdomain, faculty_id, department_id, designation_id,
        position_id, is_primary, start_date, end_date, notes, created_at, updated_at
      )
      SELECT
        'fda-gapfill-' || md5(fda.workspace_subdomain || ':' || fda.id),
        fda.workspace_subdomain,
        fda.faculty_id,
        COALESCE(
          (
            SELECT a.department_id FROM faculty_assignments a
            WHERE a.workspace_subdomain = fda.workspace_subdomain
              AND a.faculty_id = fda.faculty_id
              AND a.deleted_at IS NULL
            ORDER BY a.is_primary DESC, a.start_date DESC
            LIMIT 1
          ),
          (
            SELECT d.id FROM faculty_departments d
            WHERE d.workspace_subdomain = fda.workspace_subdomain
              AND d.deleted_at IS NULL AND d.is_active
            ORDER BY d.name
            LIMIT 1
          )
        ),
        fda.designation_id,
        (
          SELECT p.id FROM organization_positions p
          WHERE p.workspace_subdomain = fda.workspace_subdomain
            AND p.deleted_at IS NULL AND p.is_active
            AND (p.designation_id IS NULL OR p.designation_id = fda.designation_id)
            AND (
              p.department_id IS NULL
              OR p.department_id = COALESCE(
                (
                  SELECT a.department_id FROM faculty_assignments a
                  WHERE a.workspace_subdomain = fda.workspace_subdomain
                    AND a.faculty_id = fda.faculty_id
                    AND a.deleted_at IS NULL
                  ORDER BY a.is_primary DESC, a.start_date DESC
                  LIMIT 1
                ),
                (
                  SELECT d.id FROM faculty_departments d
                  WHERE d.workspace_subdomain = fda.workspace_subdomain
                    AND d.deleted_at IS NULL AND d.is_active
                  ORDER BY d.name
                  LIMIT 1
                )
              )
            )
          ORDER BY p.code
          LIMIT 1
        ),
        true,
        fda.starts_on,
        fda.ends_on,
        fda.notes,
        fda.created_at,
        fda.updated_at
      FROM faculty_designation_assignments fda
      WHERE fda.workspace_subdomain = ${tenant}
        AND (fda.ends_on IS NULL OR fda.ends_on >= CURRENT_DATE)
        AND NOT EXISTS (
          SELECT 1 FROM faculty_assignments a
          WHERE a.workspace_subdomain = fda.workspace_subdomain
            AND a.faculty_id = fda.faculty_id
            AND a.deleted_at IS NULL
            AND a.is_primary
            AND a.start_date <= COALESCE(fda.ends_on, 'infinity'::date)
            AND COALESCE(a.end_date, 'infinity'::date) >= fda.starts_on
        )
        AND EXISTS (
          SELECT 1 FROM faculty f
          WHERE f.workspace_subdomain = fda.workspace_subdomain
            AND f.id = fda.faculty_id
        )
        AND EXISTS (
          SELECT 1 FROM faculty_departments d
          WHERE d.workspace_subdomain = fda.workspace_subdomain
            AND d.deleted_at IS NULL AND d.is_active
        )
      ON CONFLICT DO NOTHING
    `);

    // Refresh denormalized faculty.designation / hierarchy_rank from primary FA.
    await tx.execute(sql`
      UPDATE faculty f SET
        designation = d.name,
        hierarchy_rank = d.hierarchy_rank,
        updated_at = NOW()
      FROM faculty_assignments a
      JOIN faculty_designations d
        ON d.workspace_subdomain = a.workspace_subdomain
        AND d.id = a.designation_id
      WHERE f.workspace_subdomain = ${tenant}
        AND a.workspace_subdomain = f.workspace_subdomain
        AND a.faculty_id = f.id
        AND a.is_primary
        AND a.deleted_at IS NULL
        AND a.start_date <= CURRENT_DATE
        AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
    `);
  });
}
