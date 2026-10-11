import { backfillFacultyReporting } from "./facultyReportingBackfill.js";
import { sql } from "drizzle-orm";
import { withGlobalTenant, withTenant } from "../tenant-context.js";
import { lockFacultyHierarchy } from "../repositories/facultyAssignmentValidation.js";

// Teachers are already renamed by 0112; preserve their original IDs and contact links.
// Each workspace commits independently, making interruption and replay safe.
export async function runMigration087(): Promise<void> {
  const tenants = await withGlobalTenant(
    async (tx) =>
      (
        await tx.execute<{ workspace_subdomain: string }>(sql`
      SELECT DISTINCT workspace_subdomain FROM faculty ORDER BY workspace_subdomain
    `)
      ).rows,
  );
  for (const { workspace_subdomain: tenant } of tenants) await backfillFacultyAssignments(tenant);
}

export async function backfillFacultyAssignments(tenant: string): Promise<void> {
  await withTenant(tenant, async (tx) => {
    await lockFacultyHierarchy(tx, tenant);
    await tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
    await tx.execute(sql`
      INSERT INTO faculty_departments (id, workspace_subdomain, name, code)
      SELECT 'legacy-dept-' || md5(${tenant} || ':' || label), ${tenant}, label,
        md5(${tenant} || ':' || label)
      FROM (SELECT DISTINCT COALESCE(NULLIF(btrim(department), ''), 'General') AS label
        FROM faculty WHERE workspace_subdomain = ${tenant}) labels
      WHERE NOT EXISTS (SELECT 1 FROM faculty_departments d WHERE d.workspace_subdomain = ${tenant}
        AND lower(d.name) = lower(labels.label) AND d.deleted_at IS NULL)
      ON CONFLICT DO NOTHING
    `);
    await tx.execute(sql`
      INSERT INTO faculty_designations (id, workspace_subdomain, name, code, hierarchy_rank)
      SELECT 'legacy-designation-' || md5(${tenant} || ':' || label), ${tenant}, label,
        md5(${tenant} || ':' || label), rank
      FROM (SELECT COALESCE(NULLIF(btrim(designation), ''), 'Faculty Member') AS label,
          min(hierarchy_rank) AS rank
        FROM faculty WHERE workspace_subdomain = ${tenant} GROUP BY 1) labels
      WHERE NOT EXISTS (SELECT 1 FROM faculty_designations d WHERE d.workspace_subdomain = ${tenant}
        AND lower(d.name) = lower(labels.label) AND d.deleted_at IS NULL)
      ON CONFLICT DO NOTHING
    `);
    // Missing join dates use the recorded creation day in UTC, never migration time.
    await tx.execute(sql`
      INSERT INTO faculty_assignments (id, workspace_subdomain, faculty_id, department_id, designation_id,
        is_primary, start_date, deleted_at, deleted_by, deletion_reason, created_at, updated_at)
      SELECT 'legacy-assignment-' || md5(f.workspace_subdomain || ':' || f.id), f.workspace_subdomain, f.id,
        (SELECT d.id FROM faculty_departments d WHERE d.workspace_subdomain = f.workspace_subdomain
          AND lower(d.name) = lower(COALESCE(NULLIF(btrim(f.department), ''), 'General'))
          AND d.deleted_at IS NULL ORDER BY d.id LIMIT 1),
        (SELECT d.id FROM faculty_designations d WHERE d.workspace_subdomain = f.workspace_subdomain
          AND lower(d.name) = lower(COALESCE(NULLIF(btrim(f.designation), ''), 'Faculty Member'))
          AND d.deleted_at IS NULL ORDER BY d.id LIMIT 1),
        true, CASE
          WHEN f.join_date IS NOT NULL AND f.join_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          THEN (substring(f.join_date::text from 1 for 10))::date
          ELSE (f.created_at AT TIME ZONE 'UTC')::date
        END,
        f.deleted_at, f.deleted_by, f.deletion_reason, f.created_at, f.updated_at
      FROM faculty f WHERE f.workspace_subdomain = ${tenant}
        AND NOT EXISTS (SELECT 1 FROM faculty_assignments a
          WHERE a.workspace_subdomain = f.workspace_subdomain AND a.faculty_id = f.id)
      ON CONFLICT DO NOTHING
    `);
    await backfillFacultyReporting(tx, tenant);
  });
}
