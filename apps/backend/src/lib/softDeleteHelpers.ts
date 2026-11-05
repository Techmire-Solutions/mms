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

/** Reads the current `app.include_deleted` GUC (transaction-local; `null` when unset). */
export async function readIncludeDeletedSetting(tx: IncludeDeletedTx): Promise<string | null> {
  if (typeof tx?.execute !== "function") return null;
  const result = (await tx.execute(
    sql`SELECT current_setting('app.include_deleted', true) AS value`,
  )) as { rows?: Array<Record<string, unknown>> } | undefined;
  const value = result?.rows?.[0]?.value;
  return typeof value === "string" ? value : null;
}

/**
 * Runs `work` with soft-deleted rows visible, then restores the previous GUC scope — including when
 * `work` throws, and without downgrading a caller that had already opted in.
 *
 * Needed because `set_config(..., true)` is transaction-scoped: a helper that opts in for one
 * internal count would otherwise leave the rest of the caller's transaction reading deleted rows.
 */
export async function withIncludeDeletedScope<T>(
  tx: IncludeDeletedTx,
  work: () => Promise<T>,
): Promise<T> {
  const previous = await readIncludeDeletedSetting(tx);
  await enableIncludeDeleted(tx);
  try {
    return await work();
  } finally {
    if (typeof tx?.execute === "function") {
      const restored = previous === "true" ? "true" : "false";
      await tx.execute(sql`SELECT set_config('app.include_deleted', ${restored}, true)`);
    }
  }
}

/** Whether a soft-delete list filter needs the include_deleted GUC under FORCE RLS. */
export function softDeleteFilterNeedsIncludeDeleted(
  deletedFilter: "active" | "deleted" | "all",
): boolean {
  return deletedFilter === "deleted" || deletedFilter === "all";
}
