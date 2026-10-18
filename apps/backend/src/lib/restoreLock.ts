import { sql } from "drizzle-orm";
import { activeDb } from "../db/dbConnection.js";

/**
 * Transaction-scoped advisory lock so only one wipe-restore can run per tenant at
 * a time. `pg_try_advisory_xact_lock` is released automatically on commit/rollback,
 * so a crashed or timed-out restore can never leave the lock held.
 *
 * Keying mirrors `contactsRepositoryAdapter.acquireUniqueValueLocks`: a fixed
 * namespace int4 plus `hashtext(subdomain)` so each workspace gets a distinct lock.
 */
const RESTORE_LOCK_NAMESPACE = "restore";

/**
 * Tries to acquire the tenant restore lock within the current transaction.
 * Returns false if another restore is already running for this tenant.
 */
export async function acquireTenantRestoreLock(subdomain: string): Promise<boolean> {
  const result = await activeDb().execute(
    sql`SELECT pg_try_advisory_xact_lock(hashtext(${RESTORE_LOCK_NAMESPACE}), hashtext(${subdomain})) AS acquired`,
  );
  const row = result.rows[0] as { acquired?: unknown } | undefined;
  return Boolean(row?.acquired);
}

/** Thrown when a concurrent restore already holds the tenant lock. */
export class RestoreInProgressError extends Error {
  readonly statusCode = 409;
  readonly type = "conflict";
  constructor() {
    super("backup.restoreInProgress");
    this.name = "RestoreInProgressError";
  }
}
