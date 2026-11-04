import { sql } from "drizzle-orm";
import { withTenant } from "../tenant-context.js";

export interface TaskDelegationOptions {
  canAssignAnywhere?: boolean;
  delegationScope?: "descendants" | "direct_reports";
  allowSelfAssignment?: boolean;
}

export interface TaskRecipientRow extends Record<string, unknown> {
  facultyId: string;
  name: string;
  employeeId: string | null;
  assignmentId: string;
  departmentName: string | null;
  userId: string;
  isSelf: boolean;
}

/** Hierarchy depth when the tenant delegates down the whole designation tree. */
const DESCENDANT_SCOPE_DEPTH = 20;
/** `direct_reports` only walks one designation level below the actor. */
const DIRECT_REPORT_SCOPE_DEPTH = 1;

/**
 * Eligible task recipients.
 *
 * A caller without `tasks.assign_anywhere` may only assign to themselves or to
 * faculty whose primary designation sits inside the tenant's delegation scope
 * (`direct_reports` = one designation level, `descendants` = the whole subtree).
 * Resolving an empty scope degrades to today's self-only behaviour, so enabling
 * hierarchy scoping can never lock an actor out.
 */
export async function findEligibleTaskRecipientRows(
  tenant: string,
  actorUserId: string,
  options: TaskDelegationOptions = {},
  facultyIds?: readonly string[],
): Promise<TaskRecipientRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  const allowSelf = options.allowSelfAssignment ?? true;
  const canAssignAnywhere = options.canAssignAnywhere ?? false;
  // 0 disables the recursive walk: `tasks.assign_anywhere` holders do not need a scope.
  const scopeDepth = canAssignAnywhere
    ? 0
    : options.delegationScope === "direct_reports"
      ? DIRECT_REPORT_SCOPE_DEPTH
      : DESCENDANT_SCOPE_DEPTH;

  return withTenant(subdomain, async (tx) => {
    const targetFilter = facultyIds
      ? sql`AND o.faculty_id IN (${sql.join(
          facultyIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;
    const eligibility = canAssignAnywhere
      ? sql`((o.user_id = ${actorUserId} AND ${allowSelf}) OR o.user_id <> ${actorUserId})`
      : sql`(
          (o.user_id = ${actorUserId} AND ${allowSelf})
          OR (
            o.user_id <> ${actorUserId}
            AND o.designation_id IN (
              SELECT scope_designations.designation_id
              FROM scope_designations
              WHERE scope_designations.depth > 0
            )
          )
        )`;
    const result = await tx.execute<TaskRecipientRow>(sql`
      WITH RECURSIVE business_day AS (
        SELECT (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(timezone, ''), 'UTC'))::date AS today
        FROM workspaces WHERE subdomain = ${subdomain}
      ), actor_designation AS (
        SELECT fa.designation_id
        FROM faculty f
        JOIN faculty_assignments fa
          ON fa.workspace_subdomain = f.workspace_subdomain
         AND fa.faculty_id = f.id
         AND fa.is_primary = true
         AND fa.status = 'active'
         AND fa.deleted_at IS NULL
        WHERE f.workspace_subdomain = ${subdomain}
          AND f.user_id = ${actorUserId}
          AND f.deleted_at IS NULL
        LIMIT 1
      ), scope_designations AS (
        SELECT ad.designation_id AS designation_id, 0 AS depth FROM actor_designation ad
        UNION ALL
        SELECT child.id, scope_designations.depth + 1
        FROM scope_designations
        JOIN faculty_designations child
          ON child.workspace_subdomain = ${subdomain}
         AND child.parent_designation_id = scope_designations.designation_id
         AND child.deleted_at IS NULL
        WHERE scope_designations.depth < ${scopeDepth}
      ), occupants AS (
        SELECT f.id AS faculty_id, fe.employee_id, u.id AS user_id, a.id AS assignment_id,
          a.designation_id AS designation_id,
          d.name AS department_name, concat_ws(' ', c.first_name, c.last_name) AS name
        FROM faculty_assignments a
        JOIN faculty f ON f.workspace_subdomain = a.workspace_subdomain AND f.id = a.faculty_id
        JOIN faculty_employments fe
          ON fe.workspace_subdomain = f.workspace_subdomain
         AND fe.id = f.employment_id
         AND fe.deleted_at IS NULL
        JOIN tenant_users u ON u.workspace_subdomain = f.workspace_subdomain AND u.id = f.user_id
        JOIN contacts c ON c.workspace_subdomain = fe.workspace_subdomain AND c.id = fe.contact_id
        LEFT JOIN faculty_departments d ON d.workspace_subdomain = a.workspace_subdomain
          AND d.id = a.department_id AND d.deleted_at IS NULL
        CROSS JOIN business_day b
        WHERE a.workspace_subdomain = ${subdomain} AND a.deleted_at IS NULL
          AND a.start_date <= b.today AND (a.end_date IS NULL OR a.end_date >= b.today)
          AND f.deleted_at IS NULL AND fe.status = 'active' AND c.deleted_at IS NULL
          AND u.deleted_at IS NULL AND COALESCE(u.profile_json->>'status', 'active') = 'active'
      )
      SELECT o.faculty_id AS "facultyId", o.employee_id AS "employeeId", o.user_id AS "userId",
        o.assignment_id AS "assignmentId",
        o.department_name AS "departmentName", o.name, o.user_id = ${actorUserId} AS "isSelf"
      FROM occupants o
      WHERE ${eligibility}
        ${targetFilter}
      ORDER BY o.faculty_id, o.assignment_id
    `);
    return result.rows;
  });
}
