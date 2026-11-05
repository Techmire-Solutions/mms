/**
 * @file tasksBulkPredicates.ts
 * @description Correlated predicates for Tasks bulk archive/restore.
 */
import { and, eq, exists, isNull, notExists, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { tasks } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";

/** Active-child predicate: the task is not currently a parent of live work. */
export function hasActiveChild(tx: TenantTransaction, subdomain: string): SQL {
  const child = alias(tasks, "bulk_delete_child");
  return notExists(
    tx
      .select({ one: sql`1` })
      .from(child)
      .where(
        and(
          eq(child.workspaceSubdomain, subdomain),
          eq(child.parentTaskId, tasks.id),
          isNull(child.deletedAt),
        ),
      ),
  );
}

/** Active-parent predicate: restoring the task cannot orphan it under a trashed parent. */
export function hasActiveParent(tx: TenantTransaction, subdomain: string): SQL {
  const parent = alias(tasks, "bulk_restore_parent");
  return exists(
    tx
      .select({ one: sql`1` })
      .from(parent)
      .where(
        and(
          eq(parent.workspaceSubdomain, subdomain),
          eq(parent.id, tasks.parentTaskId),
          isNull(parent.deletedAt),
        ),
      ),
  );
}
