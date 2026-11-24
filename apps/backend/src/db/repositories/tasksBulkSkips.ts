/**
 * @file tasksBulkSkips.ts
 * @description Skip classification for Tasks bulk archive/restore.
 */
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { taskAssignees, tasks } from "@mms/db/schema";
import type { TenantTransaction } from "@mms/db/context";

export type TaskBulkSkipReason =
  | "not_found"
  | "already_deleted"
  | "already_active"
  | "has_active_children"
  | "parent_archived"
  | "already_in_status"
  | "illegal_transition"
  | "has_unresolved_subtasks"
  | "forbidden";

export interface TaskBulkSkip {
  id: string;
  reason: TaskBulkSkipReason;
}

/** Deduplicates and trims ids, returning the requested order. */
export function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

/** Task ids the actor is currently assigned to (active assignee rows). */
export async function loadAssignedTaskIds(
  tx: TenantTransaction,
  subdomain: string,
  actorUserId: string,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await tx
    .select({ taskId: taskAssignees.taskId })
    .from(taskAssignees)
    .where(
      and(
        eq(taskAssignees.workspaceSubdomain, subdomain),
        eq(taskAssignees.userId, actorUserId),
        inArray(taskAssignees.taskId, ids),
        isNull(taskAssignees.deletedAt),
      ),
    );
  return new Set(rows.map((row) => String(row.taskId)));
}

/** Ids the actor may not touch: not creator, not assignee, without `assign_anywhere` (M2). */
export async function loadForbiddenIds(
  tx: TenantTransaction,
  subdomain: string,
  ids: string[],
  actorUserId: string,
  canAssignAnywhere: boolean,
  assignedIds: ReadonlySet<string> = new Set(),
): Promise<Set<string>> {
  if (canAssignAnywhere) return new Set();
  const rows = await tx
    .select({ id: tasks.id, createdByUserId: tasks.createdByUserId })
    .from(tasks)
    .where(and(eq(tasks.workspaceSubdomain, subdomain), inArray(tasks.id, ids)));
  return new Set(
    rows
      .filter((row) => row.createdByUserId !== actorUserId && !assignedIds.has(String(row.id)))
      .map((row) => String(row.id)),
  );
}

/** Actionable ids + the forbidden skip rows (creator/assignee/`assign_anywhere` gate). */
export async function resolveActionableIds(
  tx: TenantTransaction,
  subdomain: string,
  requested: string[],
  actorUserId: string,
  canAssignAnywhere: boolean,
): Promise<{ actionable: string[]; forbidden: TaskBulkSkip[] }> {
  const forbidden = await loadForbiddenSet(
    tx,
    subdomain,
    requested,
    actorUserId,
    canAssignAnywhere,
  );
  return {
    actionable: requested.filter((id) => !forbidden.has(id)),
    forbidden: [...forbidden].map((id) => ({ id, reason: "forbidden" as const })),
  };
}

/** Forbidden-id set (not creator, not assignee, no `assign_anywhere`). */
export async function loadForbiddenSet(
  tx: TenantTransaction,
  subdomain: string,
  requested: string[],
  actorUserId: string,
  canAssignAnywhere: boolean,
): Promise<Set<string>> {
  const assignedIds = await loadAssignedTaskIds(tx, subdomain, actorUserId, requested);
  return loadForbiddenIds(tx, subdomain, requested, actorUserId, canAssignAnywhere, assignedIds);
}

/** Task ids that still have unresolved children (subtask barrier). */
export async function loadUnresolvedParentIds(
  tx: TenantTransaction,
  subdomain: string,
  requested: string[],
): Promise<Set<string>> {
  if (requested.length === 0) return new Set();
  const rows = await tx
    .select({ parentTaskId: tasks.parentTaskId })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceSubdomain, subdomain),
        inArray(tasks.parentTaskId, requested),
        isNull(tasks.deletedAt),
        notInArray(tasks.status, ["completed", "cancelled"]),
      ),
    );
  return new Set(rows.map((row) => String(row.parentTaskId)));
}

export async function classifyDeleteSkips(
  tx: TenantTransaction,
  subdomain: string,
  ids: string[],
): Promise<TaskBulkSkip[]> {
  const rows = await tx
    .select({ id: tasks.id, deletedAt: tasks.deletedAt })
    .from(tasks)
    .where(and(eq(tasks.workspaceSubdomain, subdomain), inArray(tasks.id, ids)));
  const rowById = new Map(rows.map((row) => [String(row.id), row]));

  const activeParents = rows.filter((row) => row.deletedAt === null).map((row) => String(row.id));
  const childRows = activeParents.length
    ? await tx
        .select({ parentTaskId: tasks.parentTaskId })
        .from(tasks)
        .where(
          and(
            eq(tasks.workspaceSubdomain, subdomain),
            isNull(tasks.deletedAt),
            inArray(tasks.parentTaskId, activeParents),
          ),
        )
    : [];
  const hasChildren = new Set(childRows.map((row) => String(row.parentTaskId)));

  return ids.map((id) => {
    const row = rowById.get(id);
    if (!row) return { id, reason: "not_found" as const };
    if (row.deletedAt) return { id, reason: "already_deleted" as const };
    if (hasChildren.has(id)) return { id, reason: "has_active_children" as const };
    return { id, reason: "not_found" as const };
  });
}

export async function classifyRestoreSkips(
  tx: TenantTransaction,
  subdomain: string,
  ids: string[],
): Promise<TaskBulkSkip[]> {
  const rows = await tx
    .select({ id: tasks.id, parentTaskId: tasks.parentTaskId, deletedAt: tasks.deletedAt })
    .from(tasks)
    .where(and(eq(tasks.workspaceSubdomain, subdomain), inArray(tasks.id, ids)));
  const rowById = new Map(rows.map((row) => [String(row.id), row]));

  const parentIds = [
    ...new Set(rows.map((row) => row.parentTaskId).filter((id): id is string => Boolean(id))),
  ];
  const parents = parentIds.length
    ? await tx
        .select({ id: tasks.id, deletedAt: tasks.deletedAt })
        .from(tasks)
        .where(and(eq(tasks.workspaceSubdomain, subdomain), inArray(tasks.id, parentIds)))
    : [];
  const archivedParents = new Set(
    parents.filter((parent) => parent.deletedAt !== null).map((parent) => String(parent.id)),
  );

  return ids.map((id) => {
    const row = rowById.get(id);
    if (!row) return { id, reason: "not_found" as const };
    if (!row.deletedAt) return { id, reason: "already_active" as const };
    if (row.parentTaskId && archivedParents.has(String(row.parentTaskId))) {
      return { id, reason: "parent_archived" as const };
    }
    return { id, reason: "not_found" as const };
  });
}
