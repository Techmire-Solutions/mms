import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { getRequestTenant } from "../lib/tenantContext.js";
import { getDb } from "./dbClient.js";
import * as schema from "./schema.js";
import { applyTenantTransactionGuards } from "./tenantTransactionGuards.js";
import { resolveTenantScope, type TenantScopeOptions } from "./tenantScopeGuard.js";
import { logger } from "../lib/logger.js";
import {
  checkTenantConnectionBudget,
  decrementTenantTx,
  incrementTenantTx,
} from "./dbPoolMetrics.js";
import { getActivePoolRole, getActiveMaxPoolSize, getPool, getRootDb } from "./dbConnection.js";

export type DbClient = NodePgDatabase<typeof schema>;

export interface TransactionOptions extends TenantScopeOptions {
  statementTimeoutMs?: number;
}

const txStorage = new AsyncLocalStorage<DbClient>();

export function activeDb(): DbClient {
  return txStorage.getStore() ?? getRootDb();
}

export function hasActiveTransaction(): boolean {
  return txStorage.getStore() !== undefined;
}

/**
 * Runs a callback within a database transaction.
 * Uses AsyncLocalStorage to propagate the tx client to all nested helper calls
 * so they participate in the same transaction rather than the root connection.
 * Nested calls are no-ops (they reuse the active tx).
 *
 * Fails closed: when no tenant is bound, this throws unless the caller opted in
 * with `{ allowGlobal: true }` (or the greppable `runInGlobalTransaction`).
 * Without that guard a queue/cron path that lost its AsyncLocalStorage context
 * would silently run with `app.rls_bypass = 'on'`, i.e. across every tenant.
 */
export async function runInTransaction<T>(
  cb: () => Promise<T>,
  options?: TransactionOptions,
): Promise<T> {
  return await runTransaction(cb, false, options);
}

/**
 * `runInTransaction` for intentional platform/global work — migrations,
 * seeding, whole-database restore, platform-admin operations.
 *
 * Never call this from a tenant-scoped request path: when no tenant is bound the
 * transaction runs with RLS bypassed. When a tenant *is* bound, this behaves
 * exactly like `runInTransaction` (the tenant still scopes the transaction).
 */
export async function runInGlobalTransaction<T>(
  cb: () => Promise<T>,
  options?: Omit<TransactionOptions, "allowGlobal">,
): Promise<T> {
  return await runTransaction(cb, false, { ...options, allowGlobal: true });
}

/**
 * Registers an externally-managed transaction (e.g. `withTenant`'s transaction)
 * as the active one for the duration of `cb`, so nested `runInTransaction`/
 * `activeDb` consumers reuse it instead of opening a second pool client.
 */
export async function withActiveTransaction<T>(tx: DbClient, cb: () => Promise<T>): Promise<T> {
  return await txStorage.run(tx, cb);
}

/**
 * Binds a transaction as the active one for the current async context (and any
 * child contexts created after this call) via `enterWith`, so nested
 * `withTenant`/`activeDb`/`runInTransaction` calls join it without a callback
 * boundary. Used by the streaming snapshot/backup routes to keep a long-lived
 * transaction open across the lazy response stream. Callers must still commit or
 * roll back the transaction (e.g. in a `finally`) to release the pooled client.
 */
export function enterActiveTransaction(tx: DbClient): void {
  txStorage.enterWith(tx);
}

/**
 * Clears any active transaction bound via `enterActiveTransaction`, preventing
 * released pooled clients from lingering in the async execution context.
 */
export function clearActiveTransaction(): void {
  txStorage.enterWith(undefined as unknown as DbClient);
}

/**
 * A transaction whose lifecycle is explicitly controlled by the caller, so it can
 * remain open across an async response stream (unlike `withTenant`/`runInTransaction`,
 * which commit when their callback resolves). This is the primitive that lets the
 * snapshot/backup endpoints page DB reads and stream JSON while the connection stays
 * open, and then commit or roll back once the stream has been fully consumed (or
 * aborted). The caller MUST call `commit` or `rollback` (e.g. in a `finally`) so the
 * underlying pg client is always released back to the pool.
 */
export interface LongLivedTenantTransaction {
  /** Drizzle client bound to the open transaction — run SELECTs through this. */
  tx: DbClient;
  /** Commits and releases the pooled client back to the pool. Idempotent. */
  commit(): Promise<void>;
  /** Rolls back and releases the pooled client back to the pool. Idempotent. */
  rollback(): Promise<void>;
}

/**
 * Opens a long-lived tenant transaction. The tenant is known to be present — no
 * global opt-in is needed.
 */
export function beginLongLivedTenantTransaction(
  tenantId: string,
  options?: { statementTimeoutMs?: number },
): Promise<LongLivedTenantTransaction>;
/**
 * Opens a long-lived transaction whose tenant MAY be absent (whole-database
 * snapshot/restore). The caller must pass an explicit `allowGlobal`, so running
 * with RLS bypassed is always a visible decision at the call site.
 */
export function beginLongLivedTenantTransaction(
  tenantId: string | null | undefined,
  options: { statementTimeoutMs?: number; allowGlobal: boolean },
): Promise<LongLivedTenantTransaction>;
export async function beginLongLivedTenantTransaction(
  tenantId: string | null | undefined,
  options: TransactionOptions = {},
): Promise<LongLivedTenantTransaction> {
  const resolvedTenantId = resolveTenantScope(tenantId, options, "beginLongLivedTenantTransaction");

  if (resolvedTenantId) {
    checkTenantConnectionBudget(resolvedTenantId, getActivePoolRole(), getActiveMaxPoolSize());
    incrementTenantTx(resolvedTenantId);
  }

  const pool = getPool();
  const client = await pool.connect();

  let began = false;
  try {
    await client.query("BEGIN");
    began = true;
    // RLS guards + statement/idle timeouts are transaction-scoped (SET LOCAL), so
    // applying them right after BEGIN scopes them to the whole open transaction.
    const txDb = drizzle(client, { schema }) as unknown as DbClient;
    await applyTenantTransactionGuards(txDb, resolvedTenantId, options);

    let finished = false;
    const finish = async (action: "COMMIT" | "ROLLBACK"): Promise<void> => {
      if (finished) return;
      finished = true;
      if (resolvedTenantId) decrementTenantTx(resolvedTenantId);
      try {
        if (began) await client.query(action);
      } finally {
        client.release();
      }
    };

    return {
      tx: txDb,
      commit: () => finish("COMMIT"),
      rollback: () => finish("ROLLBACK"),
    };
  } catch (error) {
    if (resolvedTenantId) decrementTenantTx(resolvedTenantId);
    try {
      if (began) await client.query("ROLLBACK");
    } catch {
      // best-effort cleanup
    }
    client.release();
    throw error;
  }
}

/**
 * Read-only variant of `runInTransaction` using REPEATABLE READ, so every statement
 * observes one consistent snapshot (backup exports must not tear across tables).
 *
 * Fails closed on a missing tenant, exactly like `runInTransaction`.
 */
export async function runInReadSnapshotTransaction<T>(
  cb: () => Promise<T>,
  options?: TransactionOptions,
): Promise<T> {
  return await runTransaction(cb, true, options);
}

/** `runInReadSnapshotTransaction` for intentional whole-database exports. */
export async function runInGlobalReadSnapshotTransaction<T>(
  cb: () => Promise<T>,
  options?: Omit<TransactionOptions, "allowGlobal">,
): Promise<T> {
  return await runTransaction(cb, true, { ...options, allowGlobal: true });
}

const SLOW_QUERY_THRESHOLD_MS = 200;

async function runTransaction<T>(
  cb: () => Promise<T>,
  readSnapshot: boolean,
  options?: TransactionOptions,
): Promise<T> {
  const existing = txStorage.getStore();
  if (existing) return cb();

  // Fail closed BEFORE opening a transaction: resolving the tenant is what
  // decides whether `applyTenantTransactionGuards` will bypass RLS for every
  // policy in the database.
  const tenant = resolveTenantScope(getRequestTenant(), options, "runInTransaction");
  const startTime = Date.now();

  if (tenant) {
    checkTenantConnectionBudget(tenant, getActivePoolRole(), getActiveMaxPoolSize());
    incrementTenantTx(tenant);
  }

  await using _timerDisposer = {
    [Symbol.asyncDispose]: async () => {
      if (tenant) decrementTenantTx(tenant);
      const duration = Date.now() - startTime;
      if (duration > SLOW_QUERY_THRESHOLD_MS) {
        logger.warn(
          { tenant: tenant || "none", durationMs: duration, thresholdMs: SLOW_QUERY_THRESHOLD_MS },
          "Slow DB transaction",
        );
      }
    },
  };

  return await getDb().transaction(
    async (tx) => {
      await applyTenantTransactionGuards(tx, tenant, options);
      return await txStorage.run(tx, cb);
    },
    readSnapshot ? { isolationLevel: "repeatable read" } : undefined,
  );
}
