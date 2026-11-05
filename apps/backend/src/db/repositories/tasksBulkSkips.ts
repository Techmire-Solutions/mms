/**
 * @file tasksBulkSkips.ts
 * @description Skip classification for Tasks bulk archive/restore.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { tasks } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";

export type TaskBulkSkipReason =
  | "not_found"
  | "already_deleted"
  | "already_active"
  | "has_active_children"
  | "parent_archived"
  | "already_in_status"
  | "illegal_transition";

export interface TaskBulkSkip {
  id: string;
  reason: TaskBulkSkipReason;
}

/** Deduplicates and trims ids, returning the requested order. */
export function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
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
