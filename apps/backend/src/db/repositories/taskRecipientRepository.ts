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

/** Eligible task recipients (assignment-based; no position hierarchy). */
export async function findEligibleTaskRecipientRows(
  tenant: string,
  actorUserId: string,
  options: TaskDelegationOptions = {},
  facultyIds?: readonly string[],
): Promise<TaskRecipientRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const targetFilter = facultyIds
      ? sql`AND o.faculty_id IN (${sql.join(
          facultyIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;
    const result = await tx.execute<TaskRecipientRow>(sql`
      WITH business_day AS (
        SELECT (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(timezone, ''), 'UTC'))::date AS today
        FROM workspaces WHERE subdomain = ${subdomain}
      ), occupants AS (
        SELECT f.id AS faculty_id, fe.employee_id, u.id AS user_id, a.id AS assignment_id,
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
      WHERE (
        (o.user_id = ${actorUserId} AND ${options.allowSelfAssignment ?? true})
        OR (o.user_id <> ${actorUserId} AND ${options.canAssignAnywhere ?? false})
      )
        ${targetFilter}
      ORDER BY o.faculty_id, o.assignment_id
    `);
    return result.rows;
  });
}
