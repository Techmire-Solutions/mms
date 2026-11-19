/**
 * @file tasksRepository.ts
 * @description Persistence and query operations for tasks.
 */

import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  toSqlSearchPattern,
  type TaskListQuery,
  type TaskPriority,
  type TaskRecord,
  type TaskStatus,
} from "@mms/shared";
import { taskAssignees, tasks, workspaces } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { fetchAssigneesByTaskIds } from "./tasksAssigneesRepository.js";
import { isIsoDateOnly, nextIsoDay, workspaceDayStartUtc } from "../../lib/workspaceDayBounds.js";

export { getTaskMetrics } from "./tasksMetricsRepository.js";
export { createTask, updateTask, updateTaskStatus } from "./tasksWriteRepository.js";
export { deleteTask, restoreTask } from "./tasksTrashRepository.js";
import { SELECT_COLS, mapTaskRow } from "./tasksRowMapping.js";

function splitEnum<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is T => (allowed as readonly string[]).includes(value));
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
    // day in the workspace timezone, not UTC.
    const [workspace] = await tx
      .select({ timezone: workspaces.timezone })
      .from(workspaces)
      .where(eq(workspaces.subdomain, subdomain));
    const timezone = workspace?.timezone?.trim() || "UTC";

    if (query.dueFrom?.trim()) {
      const fromStr = query.dueFrom.trim();
      const fromDate = fromStr.includes("T")
        ? new Date(fromStr)
        : workspaceDayStartUtc(fromStr, timezone);
      if (!isNaN(fromDate.getTime())) {
        conditions.push(gte(tasks.dueAt, fromDate));
      }
    }
    if (query.dueTo?.trim()) {
      const toStr = query.dueTo.trim();
      if (toStr.includes("T")) {
        const toDate = new Date(toStr);
        if (!isNaN(toDate.getTime())) conditions.push(lte(tasks.dueAt, toDate));
      } else if (isIsoDateOnly(toStr)) {
        conditions.push(lt(tasks.dueAt, workspaceDayStartUtc(nextIsoDay(toStr), timezone)));
      }
    }
    const statuses = splitEnum<TaskStatus>(query.statuses, TASK_STATUSES);
    if (statuses.length > 0) conditions.push(inArray(tasks.status, statuses));
    const priorities = splitEnum<TaskPriority>(query.priorities, TASK_PRIORITIES);
    if (priorities.length > 0) conditions.push(inArray(tasks.priority, priorities));
    const ids = (query.ids ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 500);
    if (ids.length > 0) conditions.push(inArray(tasks.id, ids));
    if (query.overdue) {
      conditions.push(
        and(lt(tasks.dueAt, new Date()), notInArray(tasks.status, ["completed", "cancelled"]))!,
      );
    }
    if (query.dueOn?.trim() && isIsoDateOnly(query.dueOn.trim())) {
      const day = query.dueOn.trim();
      conditions.push(
        and(
          gte(tasks.dueAt, workspaceDayStartUtc(day, timezone)),
          lt(tasks.dueAt, workspaceDayStartUtc(nextIsoDay(day), timezone)),
        )!,
      );
    }
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
