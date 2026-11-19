/**
 * @file tasksRepository.ts
 * @description Persistence and query operations for tasks.
 */

import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { type TaskListQuery, type TaskRecord } from "@mms/shared";
import { taskAssignees, tasks, tenantUsers, workspaces } from "../schema.js";
import { withTenantRead, type TenantTransaction } from "../tenant-context.js";
import { fetchAssigneesByTaskIds } from "./tasksAssigneesRepository.js";
import { buildTaskFilterConditions } from "./tasksFilterConditions.js";

export { getTaskMetrics } from "./tasksMetricsRepository.js";
export { createTask, updateTask, updateTaskStatus } from "./tasksWriteRepository.js";
export { deleteTask, restoreTask } from "./tasksTrashRepository.js";
import { SELECT_COLS, mapTaskRow } from "./tasksRowMapping.js";

/** Batched creator display names for the selected `createdByUserId` values (m15). */
async function fetchCreatorNamesByUserIds(
  tx: TenantTransaction,
  subdomain: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await tx
    .select({ id: tenantUsers.id, name: tenantUsers.name })
    .from(tenantUsers)
    .where(and(eq(tenantUsers.workspaceSubdomain, subdomain), inArray(tenantUsers.id, unique)));
  return new Map(rows.map((row) => [String(row.id), row.name]));
}

export async function listTasks(
  tenant: string,
  query: TaskListQuery,
): Promise<{ tasks: TaskRecord[]; total: number }> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const conditions = [
      eq(tasks.workspaceSubdomain, subdomain),
      query.includeDeleted ? isNotNull(tasks.deletedAt) : isNull(tasks.deletedAt),
    ];

    if (query.status) conditions.push(eq(tasks.status, query.status));
    if (query.priority) conditions.push(eq(tasks.priority, query.priority));
    if (query.createdById) conditions.push(eq(tasks.createdByUserId, query.createdById));

    // Workspace-local day boundaries (m5): date-only filters denote a calendar
    // day in the workspace timezone, not UTC. Only load the timezone when a date
    // filter is present (D5).
    let timezone = "UTC";
    if (query.dueFrom?.trim() || query.dueTo?.trim() || query.dueOn?.trim()) {
      const [workspace] = await tx
        .select({ timezone: workspaces.timezone })
        .from(workspaces)
        .where(eq(workspaces.subdomain, subdomain));
      timezone = workspace?.timezone?.trim() || "UTC";
    }

    conditions.push(...buildTaskFilterConditions(query, timezone));

    if (query.assignedToFacultyId || query.assignedToUserId) {
      const assigneeConditions = [
        eq(taskAssignees.workspaceSubdomain, subdomain),
        isNull(taskAssignees.deletedAt),
      ];
      if (query.assignedToFacultyId) {
        assigneeConditions.push(eq(taskAssignees.facultyId, query.assignedToFacultyId));
      }
      if (query.assignedToUserId) {
        assigneeConditions.push(eq(taskAssignees.userId, query.assignedToUserId));
      }
      const matched = await tx
        .select({ taskId: taskAssignees.taskId })
        .from(taskAssignees)
        .where(and(...assigneeConditions));
      const ids = matched.map((m) => m.taskId);
      if (ids.length === 0) return { tasks: [], total: 0 };
      conditions.push(inArray(tasks.id, ids));
    }

    const whereClause = and(...conditions);

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(whereClause);

    const rows = await tx
      .select(SELECT_COLS)
      .from(tasks)
      .where(whereClause)
      .orderBy(desc(tasks.createdAt))
      .limit(query.limit)
      .offset(query.offset);

    if (rows.length === 0) return { tasks: [], total: count };

    const assigneesByTaskId = await fetchAssigneesByTaskIds(
      tx,
      subdomain,
      rows.map((r) => r.id),
    );
    const creatorNames = await fetchCreatorNamesByUserIds(
      tx,
      subdomain,
      rows.map((r) => r.createdByUserId),
    );

    return {
      tasks: rows.map((r) => mapTaskRow(r, assigneesByTaskId, creatorNames)),
      total: count,
    };
  });
}

export async function findTaskById(tenant: string, id: string): Promise<TaskRecord | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [taskRow] = await tx
      .select(SELECT_COLS)
      .from(tasks)
      .where(
        and(eq(tasks.workspaceSubdomain, subdomain), eq(tasks.id, id), isNull(tasks.deletedAt)),
      )
      .limit(1);

    if (!taskRow) return null;

    const assigneesMap = await fetchAssigneesByTaskIds(tx, subdomain, [id]);
    const creatorNames = await fetchCreatorNamesByUserIds(tx, subdomain, [taskRow.createdByUserId]);
    return mapTaskRow(taskRow, assigneesMap, creatorNames);
  });
}
