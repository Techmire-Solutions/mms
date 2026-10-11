import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { loadServerConfig } from "../config/serverConfig.js";
import { getRequestTenant } from "../lib/tenantContext.js";
import { getDb, setDb } from "./dbClient.js";
import * as schema from "./schema.js";
import { applyTenantTransactionGuards } from "./tenantTransactionGuards.js";
import { logger } from "../lib/logger.js";
import { ServiceUnavailableError } from "../lib/httpErrors.js";

export type DbClient = NodePgDatabase<typeof schema>;

const txStorage = new AsyncLocalStorage<DbClient>();
let pool: pg.Pool | null = null;
let readReplicaPool: pg.Pool | null = null;
let rootDb: DbClient | null = null;
let readReplicaDb: DbClient | null = null;

export type DatabasePoolRole = "http" | "worker";

export interface DatabaseConnectionOptions {
  role?: DatabasePoolRole;
  max?: number;
}

let activePoolRole: DatabasePoolRole = "http";
let activeMaxPoolSize = 30;

const tenantTxCounts = new Map<string, number>();

function incrementTenantTx(tenant: string): void {
  tenantTxCounts.set(tenant, (tenantTxCounts.get(tenant) || 0) + 1);
}

function decrementTenantTx(tenant: string): void {
  const count = tenantTxCounts.get(tenant) || 0;
  if (count <= 1) {
    tenantTxCounts.delete(tenant);
  } else {
    tenantTxCounts.set(tenant, count - 1);
  }
}

function checkTenantConnectionBudget(tenant: string): void {
  if (activePoolRole === "http") {
    const active = tenantTxCounts.get(tenant) || 0;
    // Cap any single tenant at 40% of the HTTP pool (min 5 connections)
    const limit = Math.max(5, Math.floor(activeMaxPoolSize * 0.4));
    if (active >= limit) {
      throw new ServiceUnavailableError(
        `Too many concurrent database requests for workspace. Please try again shortly.`,
      );
    }
  }
}

export function getActivePoolRole(): DatabasePoolRole {
  return activePoolRole;
}

export function initializeDatabaseConnection(options?: DatabaseConnectionOptions): void {
  if (pool) return;

  const config = loadServerConfig();
  const role = options?.role ?? (process.env.MMS_PROCESS_ROLE === "worker" ? "worker" : "http");
  activePoolRole = role;

  const defaultMax = role === "worker" ? 10 : Math.min(Math.max(config.pgPoolMax, 20), 30);
  const poolMax = options?.max ?? defaultMax;
  activeMaxPoolSize = poolMax;

  const poolConfig: pg.PoolConfig = {
    max: poolMax,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    maxUses: 7_500,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    allowExitOnIdle: false,
  };

  pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ...poolConfig,
  });
  pool.on("error", (error) => {
    // Idle clients can be terminated during platform DB reset; log and continue.
    logger.error({ err: error }, "Unexpected database pool client error");
  });
  pool.on("connect", (client) => {
    client.on("error", (err) => {
      logger.warn({ err }, "Unexpected error on checked-out database client");
    });
  });

  const hasDistinctReplica = Boolean(
    config.readReplicaDatabaseUrl && config.readReplicaDatabaseUrl !== config.databaseUrl,
  );

  if (hasDistinctReplica) {
    readReplicaPool = new pg.Pool({
      connectionString: config.readReplicaDatabaseUrl,
      ...poolConfig,
    });
    readReplicaPool.on("error", (error) => {
      logger.error({ err: error }, "Unexpected read-replica database pool client error");
    });
  } else {
    readReplicaPool = pool;
  }
  readReplicaPool.on("connect", (client) => {
    client.on("error", (err) => {
      logger.warn({ err }, "Unexpected error on checked-out read-replica database client");
    });
  });

  rootDb = drizzle(pool, { schema });
  readReplicaDb = hasDistinctReplica ? drizzle(readReplicaPool, { schema }) : rootDb;
  setDb(rootDb);
}

export function getRootDb(): DbClient {
  if (!rootDb) throw new Error("Database not initialized");
  return rootDb;
}

export function getReadReplicaDb(): DbClient {
  if (!readReplicaDb) throw new Error("Read replica database not initialized");
  return readReplicaDb;
}

export function activeDb(): DbClient {
  return txStorage.getStore() ?? getRootDb();
}

export function hasActiveTransaction(): boolean {
  return txStorage.getStore() !== undefined;
}

export function getPool(): pg.Pool {
  if (!pool) throw new Error("Database pool not initialized");
  return pool;
}

/** Interface representing active DB connection pool utilization metrics. */
export interface PoolMetrics {
  role?: DatabasePoolRole;
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  replica?: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
}

/** Returns connection count telemetry for database health checks. */
export function getPoolMetrics(): PoolMetrics | null {
  if (!pool) return null;
  const metrics: PoolMetrics = {
    role: activePoolRole,
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
  if (readReplicaPool && readReplicaPool !== pool) {
    metrics.replica = {
      totalCount: readReplicaPool.totalCount,
      idleCount: readReplicaPool.idleCount,
      waitingCount: readReplicaPool.waitingCount,
    };
  }
  return metrics;
}

export interface TenantDbMetrics {
  activeTenantsCount: number;
  totalTenantActiveTransactions: number;
  tenantCapLimit: number;
  tenantBudgetPercent: number;
  activeTenants: { tenant: string; count: number }[];
}

/** Returns live per-tenant active transaction metrics and connection budget. */
export function getTenantDbMetrics(): TenantDbMetrics {
  const activeTenants = Array.from(tenantTxCounts.entries())
    .filter(([_, count]) => count > 0)
    .map(([tenant, count]) => ({ tenant, count }));
  const totalTenantActiveTransactions = activeTenants.reduce((sum, item) => sum + item.count, 0);
  const tenantCapLimit = Math.max(5, Math.floor(activeMaxPoolSize * 0.4));
  return {
    activeTenantsCount: activeTenants.length,
    totalTenantActiveTransactions,
    tenantCapLimit,
    tenantBudgetPercent: 40,
    activeTenants,
  };
}

/** Lightweight DB connectivity check for `/ready`. */
export async function pingDatabase(): Promise<boolean> {
  try {
    if (!pool || !rootDb) return false;
    await rootDb.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  if (!pool) return;
  const ending = pool;
  const endingReplica = readReplicaPool && readReplicaPool !== pool ? readReplicaPool : null;
  pool = null;
  readReplicaPool = null;
  rootDb = null;
  readReplicaDb = null;
  setDb(null);
  try {
    const promises = [ending.end()];
    if (endingReplica) promises.push(endingReplica.end());
    await Promise.all(promises);
  } catch (error) {
    logger.error({ err: error }, "Error closing database pool");
  }
}

/**
 * Runs a callback within a database transaction.
 * Uses AsyncLocalStorage to propagate the tx client to all nested helper calls
 * so they participate in the same transaction rather than the root connection.
 * Nested calls are no-ops (they reuse the active tx).
 */
export async function runInTransaction<T>(
  cb: () => Promise<T>,
  options?: { statementTimeoutMs?: number },
): Promise<T> {
  return await runTransaction(cb, false, options);
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

export async function beginLongLivedTenantTransaction(
  tenantId: string | null | undefined,
  options?: { statementTimeoutMs?: number },
): Promise<LongLivedTenantTransaction> {
  const resolvedTenantId = tenantId || "";
  if (resolvedTenantId === "undefined" || resolvedTenantId === "null") {
    throw new Error(
      `beginLongLivedTenantTransaction received the literal string "${resolvedTenantId}" as tenant id`,
    );
  }

  if (resolvedTenantId) {
    checkTenantConnectionBudget(resolvedTenantId);
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
 */
export async function runInReadSnapshotTransaction<T>(
  cb: () => Promise<T>,
  options?: { statementTimeoutMs?: number },
): Promise<T> {
  return await runTransaction(cb, true, options);
}

const SLOW_QUERY_THRESHOLD_MS = 200;

async function runTransaction<T>(
  cb: () => Promise<T>,
  readSnapshot: boolean,
  options?: { statementTimeoutMs?: number },
): Promise<T> {
  const existing = txStorage.getStore();
  if (existing) return cb();

  const tenant = getRequestTenant();
  const startTime = Date.now();

  if (tenant) {
    checkTenantConnectionBudget(tenant);
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
