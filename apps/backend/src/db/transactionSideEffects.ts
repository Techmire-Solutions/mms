import { activeDb, hasActiveTransaction } from "./dbTransactions.js";
import type { TenantTransaction } from "./tenant-context.js";

/**
 * Runs `cb` inside a SAVEPOINT on the ambient transaction. A statement failure rolls back to the
 * savepoint (the outer transaction stays usable), which is what lets per-item loops — bulk session
 * transitions, invoice cancellation during a session cancel — record a failure and continue.
 * Requires an active transaction: there is nothing to save to otherwise.
 */
export async function withSavepoint<T>(
  cb: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  if (!hasActiveTransaction()) {
    throw new Error("[withSavepoint] no active transaction — wrap the operation in withTenant()");
  }
  const client = activeDb();
  return client.transaction((savepoint) => cb(savepoint as unknown as TenantTransaction));
}
