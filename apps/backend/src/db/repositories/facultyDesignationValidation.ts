import { sql } from "drizzle-orm";
import { FACULTY_DESIGNATION_HIERARCHY_MAX_DEPTH } from "@mms/shared";
import type { TenantTransaction } from "../tenant-context.js";
import { FacultyCatalogConflictError } from "./facultyDepartmentValidation.js";
import { lockFacultyHierarchy } from "./facultyAssignmentValidation.js";

type Executor = Pick<TenantTransaction, "execute">;

export interface DesignationValidationInput {
  id: string;
  departmentId: string;
  name: string;
  parentDesignationId: string | null;
}

/**
 * Faculty Management model guards for a designation write:
 * live department, live parent without cycles (depth ≤ 20), and a name that is
 * unique inside the department (case-insensitive). Returns the derived
 * hierarchy rank (parent rank + 1, root = 1).
 */
export async function validateFacultyDesignation(
  tx: Executor,
  tenant: string,
  input: DesignationValidationInput,
): Promise<{ hierarchyRank: number }> {
  await lockFacultyHierarchy(tx, tenant);
  if (!input.name.trim()) throw new Error("Designation name is required");
  const existing = await tx.execute<{ deleted_at: Date | null }>(sql`
    SELECT deleted_at FROM faculty_designations WHERE workspace_subdomain = ${tenant}
      AND id = ${input.id} FOR UPDATE
  `);
  if (existing.rows.some((row) => row.deleted_at !== null))
    throw new Error("Designation is archived");

  const department = await tx.execute<{ id: string }>(sql`
    SELECT id FROM faculty_departments WHERE workspace_subdomain = ${tenant}
      AND id = ${input.departmentId} AND deleted_at IS NULL LIMIT 1
  `);
  if (!department.rows.length) throw new Error("Department is missing or archived");

  const duplicate = await tx.execute<{ id: string }>(sql`
    SELECT id FROM faculty_designations
    WHERE workspace_subdomain = ${tenant} AND id <> ${input.id} AND deleted_at IS NULL
      AND department_id = ${input.departmentId}
      AND lower(btrim(name)) = lower(btrim(${input.name}))
    LIMIT 1
  `);
  if (duplicate.rows.length) {
    throw new FacultyCatalogConflictError(
      "A designation with this name already exists in this department",
    );
  }

  if (!input.parentDesignationId) return { hierarchyRank: 1 };
  if (input.parentDesignationId === input.id)
    throw new Error("A designation cannot be its own parent");
  const ancestors = await tx.execute<{ id: string; depth: number; cycle: boolean }>(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_designation_id, 1 AS depth, ARRAY[id] AS path, FALSE AS cycle
      FROM faculty_designations
      WHERE workspace_subdomain = ${tenant} AND id = ${input.parentDesignationId} AND deleted_at IS NULL
      UNION ALL
      SELECT d.id, d.parent_designation_id, a.depth + 1, a.path || d.id, d.id = ANY(a.path)
      FROM faculty_designations d JOIN ancestors a ON a.parent_designation_id = d.id
      WHERE d.workspace_subdomain = ${tenant} AND d.deleted_at IS NULL AND NOT a.cycle
        AND a.depth < ${FACULTY_DESIGNATION_HIERARCHY_MAX_DEPTH}
    ) SELECT id, depth, cycle FROM ancestors
  `);
  if (!ancestors.rows.length) throw new Error("Parent designation is missing or archived");
  if (ancestors.rows.some((row) => row.id === input.id || row.cycle)) {
    throw new Error("Circular designation hierarchy detected");
  }
  const parentRank = ancestors.rows.length;
  if (parentRank >= FACULTY_DESIGNATION_HIERARCHY_MAX_DEPTH) {
    throw new Error("Designation hierarchy depth limit exceeded");
  }
  return { hierarchyRank: parentRank + 1 };
}

/** Re-derives `hierarchy_rank` for every live descendant after a parent change. */
export async function recomputeDescendantRanks(
  tx: Executor,
  tenant: string,
  rootId: string,
): Promise<void> {
  await tx.execute(sql`
    WITH RECURSIVE tree AS (
      SELECT id, hierarchy_rank FROM faculty_designations
      WHERE workspace_subdomain = ${tenant} AND id = ${rootId}
      UNION ALL
      SELECT d.id, t.hierarchy_rank + 1
      FROM faculty_designations d JOIN tree t ON d.parent_designation_id = t.id
      WHERE d.workspace_subdomain = ${tenant} AND d.deleted_at IS NULL
        AND t.hierarchy_rank < ${FACULTY_DESIGNATION_HIERARCHY_MAX_DEPTH}
    )
    UPDATE faculty_designations f SET hierarchy_rank = tree.hierarchy_rank, updated_at = now()
    FROM tree
    WHERE f.workspace_subdomain = ${tenant} AND f.id = tree.id AND f.id <> ${rootId}
      AND f.hierarchy_rank <> tree.hierarchy_rank
  `);
}

/** A designation cannot be archived while faculty, appointments, or child designations reference it. */
export async function validateDesignationDeletion(
  tx: Executor,
  tenant: string,
  id: string,
): Promise<void> {
  await lockFacultyHierarchy(tx, tenant);
  const dependents = await tx.execute<{ id: string }>(sql`
    SELECT fed.id FROM faculty_employ_designations fed
    WHERE fed.workspace_subdomain = ${tenant} AND fed.designation_id = ${id} AND fed.deleted_at IS NULL
    UNION ALL
    SELECT id FROM faculty_designations WHERE workspace_subdomain = ${tenant}
      AND parent_designation_id = ${id} AND deleted_at IS NULL
    UNION ALL
    SELECT a.id FROM faculty_assignments a
    JOIN faculty f ON f.workspace_subdomain = a.workspace_subdomain AND f.id = a.faculty_id AND f.deleted_at IS NULL
    WHERE a.workspace_subdomain = ${tenant} AND a.designation_id = ${id} AND a.deleted_at IS NULL
    LIMIT 1
  `);
  if (dependents.rows.length) {
    throw new FacultyCatalogConflictError(
      "Designation has dependent faculty, appointments, or child designations",
    );
  }
}
