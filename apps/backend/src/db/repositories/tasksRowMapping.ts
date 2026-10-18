import type { TaskRecord, TaskPriority, TaskStatus } from "@mms/shared";
import { tasks } from "../schema.js";

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
  assignedByUserId: tasks.assignedByUserId,
  completedAt: tasks.completedAt,
  cancelledAt: tasks.cancelledAt,
  deletedAt: tasks.deletedAt,
  deletedBy: tasks.deletedBy,
  deletionReason: tasks.deletionReason,
  restoredAt: tasks.restoredAt,
  restoredBy: tasks.restoredBy,
  deletedWithCascade: tasks.deletedWithCascade,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  createdBy: tasks.createdBy,
  updatedBy: tasks.updatedBy,
} as const;

export function mapTaskRow(
  r: typeof tasks.$inferSelect,
  assigneesMap: Map<string, TaskRecord["assignees"]>,
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
    assignees: assigneesMap.get(r.id) ?? [],
    createdAt: r.createdAt ? r.createdAt.toISOString() : undefined,
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : undefined,
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}
