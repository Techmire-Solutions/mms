/**
 * Unified soft-delete lifecycle record builders and timestamp utilities.
 */

import { sql, type SQLWrapper } from "drizzle-orm";

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Produces a restored copy of an archived record, clearing soft-delete metadata
 * and stamping restoredAt, restoredBy, and updatedAt.
 */
export function buildRestoredRecord<T extends Record<string, unknown>>(
  existing: T,
  userId?: string,
): T {
  const now = nowIso();
  return {
    ...existing,
    deletedAt: undefined,
    deletedBy: undefined,
    deletionReason: undefined,
    restoredAt: now,
    restoredBy: userId,
    updatedAt: now,
  };
}

type IncludeDeletedTx = {
  execute?: (query: string | SQLWrapper) => Promise<unknown> | unknown;
};

/**
 * Opt into reading soft-deleted rows for the rest of the current transaction
 * (FORCE RLS soft-delete policies require `app.include_deleted = 'true'`).
 */
export async function enableIncludeDeleted(tx: IncludeDeletedTx): Promise<void> {
  if (typeof tx?.execute === "function") {
    await tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
  }
}

/** Whether a soft-delete list filter needs the include_deleted GUC under FORCE RLS. */
export function softDeleteFilterNeedsIncludeDeleted(
  deletedFilter: "active" | "deleted" | "all",
): boolean {
  return deletedFilter === "deleted" || deletedFilter === "all";
}
