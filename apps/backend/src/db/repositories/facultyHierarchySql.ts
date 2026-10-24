import { sql } from "drizzle-orm";
import { facultyAssignmentSchema } from "@mms/shared";

export function validateHierarchyDepth(maxDepth: number): void {
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 20) {
    throw new Error("Hierarchy depth must be an integer between 1 and 20");
  }
}

/**
 * Organization positions removed — hierarchy walks return no rows.
 * Signature kept for callers until hierarchy is redesigned.
 */
export function assignmentHierarchySql(
  tenant: string,
  _assignmentId: string,
  _direction: "up" | "down",
  maxDepth: number,
  options: { facultyId?: string; onDate?: string } = {},
) {
  validateHierarchyDepth(maxDepth);
  if (options.onDate !== undefined) facultyAssignmentSchema.shape.startDate.parse(options.onDate);
  return sql`
    SELECT
      NULL::text AS id,
      NULL::text AS "facultyId",
      NULL::text AS "departmentId",
      NULL::text AS "designationId",
      NULL::boolean AS "isPrimary",
      NULL::text AS "startDate",
      NULL::text AS "endDate",
      0 AS depth,
      ARRAY[]::text[] AS path,
      FALSE AS "isCycle",
      NULL::text AS "facultyName"
    WHERE FALSE AND ${tenant} IS NOT NULL
  `;
}
