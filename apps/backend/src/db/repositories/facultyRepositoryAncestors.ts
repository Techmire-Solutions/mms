import { sql } from "drizzle-orm";
import type { Faculty } from "@mms/shared";
import { withTenantRead } from "../tenant-context.js";
import { findFacultyByIds } from "./facultyRepository.js";

/**
 * Finds direct subordinates for a faculty supervisor based on the
 * primary designation hierarchy.
 */
export async function findSubordinates(tenant: string, supervisorId: string): Promise<Faculty[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const res = await tx.execute<{ subordinate_id: string }>(sql`
      SELECT DISTINCT sub_fa.faculty_id AS subordinate_id
      FROM faculty_assignments sup_fa
      JOIN faculty_designations child_desig
        ON child_desig.workspace_subdomain = sup_fa.workspace_subdomain
        AND child_desig.parent_designation_id = sup_fa.designation_id
        AND child_desig.deleted_at IS NULL
      JOIN faculty_assignments sub_fa
        ON sub_fa.workspace_subdomain = sup_fa.workspace_subdomain
        AND sub_fa.designation_id = child_desig.id
        AND sub_fa.is_primary = true
        AND sub_fa.status = 'active'
        AND sub_fa.deleted_at IS NULL
      JOIN faculty f
        ON f.workspace_subdomain = sub_fa.workspace_subdomain
        AND f.id = sub_fa.faculty_id
        AND f.deleted_at IS NULL
      WHERE sup_fa.workspace_subdomain = ${subdomain}
        AND sup_fa.faculty_id = ${supervisorId}
        AND sup_fa.is_primary = true
        AND sup_fa.status = 'active'
        AND sup_fa.deleted_at IS NULL
        AND sub_fa.faculty_id <> ${supervisorId}
    `);
    const ids = (res.rows ?? []).map((r) => String(r.subordinate_id)).filter(Boolean);
    if (!ids.length) return [];
    return findFacultyByIds(subdomain, ids);
  });
}

/**
 * Resolves direct supervisors in batch for a set of faculty members
 * by inspecting their primary designation's parent designation.
 */
export async function findDirectSupervisorsBatch(
  tenant: string,
  facultyIds: string[],
): Promise<Record<string, string>> {
  if (!facultyIds.length) return {};
  const subdomain = tenant.trim().toLowerCase();
  const idList = sql.join(
    facultyIds.map((id) => sql`${id}`),
    sql`, `,
  );
  return withTenantRead(subdomain, async (tx) => {
    const res = await tx.execute<{ member_id: string; supervisor_id: string }>(sql`
      SELECT
        fa.faculty_id AS member_id,
        sup_fa.faculty_id AS supervisor_id
      FROM faculty_assignments fa
      JOIN faculty_designations d
        ON d.workspace_subdomain = fa.workspace_subdomain
        AND d.id = fa.designation_id
        AND d.deleted_at IS NULL
      JOIN faculty_assignments sup_fa
        ON sup_fa.workspace_subdomain = fa.workspace_subdomain
        AND sup_fa.designation_id = d.parent_designation_id
        AND sup_fa.is_primary = true
        AND sup_fa.status = 'active'
        AND sup_fa.deleted_at IS NULL
      JOIN faculty sf
        ON sf.workspace_subdomain = sup_fa.workspace_subdomain
        AND sf.id = sup_fa.faculty_id
        AND sf.deleted_at IS NULL
      WHERE fa.workspace_subdomain = ${subdomain}
        AND fa.faculty_id IN (${idList})
        AND fa.is_primary = true
        AND fa.status = 'active'
        AND fa.deleted_at IS NULL
        AND d.parent_designation_id IS NOT NULL
    `);
    const mapping: Record<string, string> = {};
    for (const row of res.rows ?? []) {
      if (row.member_id && row.supervisor_id && row.member_id !== row.supervisor_id) {
        mapping[String(row.member_id)] = String(row.supervisor_id);
      }
    }
    return mapping;
  });
}

/**
 * Traverses the supervisory hierarchy upward via recursive CTE
 * to detect reporting cycles and build ancestor chains.
 */
export async function findAncestorChain(
  tenant: string,
  facultyId: string,
  maxDepth = 50,
): Promise<string[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const res = await tx.execute<{ ancestor_id: string }>(sql`
      WITH RECURSIVE desig_ancestors AS (
        SELECT d.parent_designation_id, 1 AS depth
        FROM faculty_assignments fa
        JOIN faculty_designations d
          ON d.workspace_subdomain = fa.workspace_subdomain
          AND d.id = fa.designation_id
          AND d.deleted_at IS NULL
        WHERE fa.workspace_subdomain = ${subdomain}
          AND fa.faculty_id = ${facultyId}
          AND fa.is_primary = true
          AND fa.status = 'active'
          AND fa.deleted_at IS NULL
          AND d.parent_designation_id IS NOT NULL

        UNION ALL

        SELECT d.parent_designation_id, da.depth + 1
        FROM faculty_designations d
        JOIN desig_ancestors da
          ON d.workspace_subdomain = ${subdomain}
          AND d.id = da.parent_designation_id
          AND d.deleted_at IS NULL
        WHERE d.parent_designation_id IS NOT NULL
          AND da.depth < ${maxDepth}
      )
      SELECT DISTINCT sup_fa.faculty_id AS ancestor_id
      FROM desig_ancestors da
      JOIN faculty_assignments sup_fa
        ON sup_fa.workspace_subdomain = ${subdomain}
        AND sup_fa.designation_id = da.parent_designation_id
        AND sup_fa.is_primary = true
        AND sup_fa.status = 'active'
        AND sup_fa.deleted_at IS NULL
      JOIN faculty sf
        ON sf.workspace_subdomain = sup_fa.workspace_subdomain
        AND sf.id = sup_fa.faculty_id
        AND sf.deleted_at IS NULL
    `);
    return (res.rows ?? []).map((r) => String(r.ancestor_id)).filter(Boolean);
  });
}
