import { validateHierarchyDepth } from "./facultyHierarchySql.js";
import { sql } from "drizzle-orm";
import { withTenantRead } from "../tenant-context.js";

export interface DepartmentAncestor {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  depth: number;
  isCycle: boolean;
}

/**
 * Traverses up the department tree from `departmentId` to the root using a
 * single PostgreSQL recursive CTE. Returns ancestors ordered from immediate
 * parent to root (depth ascending).
 *
 * Cycle protection: the CTE uses array path tracking (`NOT id = ANY(path)`)
 * and a hard depth cap (default 20).
 */
export async function findDepartmentAncestorChain(
  tenant: string,
  departmentId: string,
  maxDepth = 20,
): Promise<DepartmentAncestor[]> {
  validateHierarchyDepth(maxDepth);
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx.execute<{
      id: string;
      name: string;
      code: string;
      parent_id: string | null;
      depth: number;
      is_cycle: boolean;
    }>(sql`
      WITH RECURSIVE dept_ancestor AS (
        SELECT
          d.id,
          d.name,
          d.code,
          d.parent_id,
          0                  AS depth,
          ARRAY[d.id]        AS path,
          FALSE              AS is_cycle
        FROM faculty_departments d
        WHERE d.workspace_subdomain = ${subdomain}
          AND d.id = ${departmentId}
          AND d.deleted_at IS NULL

        UNION ALL

        SELECT
          p.id,
          p.name,
          p.code,
          p.parent_id,
          da.depth + 1,
          da.path || p.id,
          p.id = ANY(da.path)
        FROM faculty_departments p
        INNER JOIN dept_ancestor da ON da.parent_id = p.id
        WHERE p.workspace_subdomain = ${subdomain}
          AND p.deleted_at IS NULL
          AND NOT da.is_cycle
          AND da.depth < ${maxDepth}
      )
      SELECT id, name, code, parent_id, depth, is_cycle
      FROM dept_ancestor
      WHERE depth > 0
      ORDER BY depth
    `);
    return rows.rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      parentId: r.parent_id,
      depth: r.depth,
      isCycle: r.is_cycle,
    }));
  });
}
