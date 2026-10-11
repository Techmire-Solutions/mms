/**
 * @file tasksRepository.ts
 * @description Persistence and query operations for tasks.
 */

import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { toSqlSearchPattern, type TaskListQuery, type TaskRecord } from "@mms/shared";
import { taskAssignees, tasks } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { fetchAssigneesByTaskIds } from "./tasksAssigneesRepository.js";

export { getTaskMetrics } from "./tasksMetricsRepository.js";
export { createTask, updateTask, updateTaskStatus } from "./tasksWriteRepository.js";
export { deleteTask, restoreTask, bulkRestoreTasks } from "./tasksTrashRepository.js";
import { SELECT_COLS, mapTaskRow } from "./tasksRowMapping.js";

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
    if (query.search) {
      const term = toSqlSearchPattern(query.search);
      conditions.push(or(ilike(tasks.title, term), ilike(tasks.description, term))!);
    }

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

    return {
      tasks: rows.map((r) => mapTaskRow(r, assigneesByTaskId)),
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
    return mapTaskRow(taskRow, assigneesMap);
  });
}
