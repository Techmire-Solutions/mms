import type { TaskRecord, TaskPriority, TaskStatus } from "@mms/contracts";
import { tasks } from "@mms/db/schema";

export const SELECT_COLS = {
  id: tasks.id,
  workspaceSubdomain: tasks.workspaceSubdomain,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  startDate: tasks.startDate,
  dueAt: tasks.dueAt,
  parentTaskId: tasks.parentTaskId,
  createdByUserId: tasks.createdByUserId,
  deletedAt: tasks.deletedAt,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
} as const;

export function mapTaskRow(
  r: { [K in keyof typeof SELECT_COLS]: (typeof tasks.$inferSelect)[K] },
  assigneesMap: Map<string, TaskRecord["assignees"]>,
  creatorNamesMap: Map<string, string> = new Map(),
): TaskRecord {
  return {
    id: r.id,
    workspaceSubdomain: r.workspaceSubdomain,
    title: r.title,
    description: r.description,
    status: r.status as TaskStatus,
    priority: r.priority as TaskPriority,
    startDate: r.startDate ?? null,
    dueAt: r.dueAt ? r.dueAt.toISOString() : null,
    parentTaskId: r.parentTaskId,
    createdById: r.createdByUserId,
    creatorName: r.createdByUserId ? creatorNamesMap.get(r.createdByUserId) : undefined,
    assignees: assigneesMap.get(r.id) ?? [],
    createdAt: r.createdAt ? r.createdAt.toISOString() : undefined,
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : undefined,
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}
