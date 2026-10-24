import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { loadServerConfig } from "../config/serverConfig.js";
import { setDb } from "./dbClient.js";
import * as schema from "./schema.js";
import { logger } from "../lib/logger.js";
import {
  buildPoolMetrics,
  buildTenantDbMetrics,
  type DatabasePoolRole,
  type PoolMetrics,
  type TenantDbMetrics,
} from "./dbPoolMetrics.js";
import type { DbClient } from "./dbTransactions.js";

export type { DbClient };
export type { DatabasePoolRole, PoolMetrics, TenantDbMetrics };
export * from "./dbTransactions.js";

let pool: pg.Pool | null = null;
let readReplicaPool: pg.Pool | null = null;
let rootDb: DbClient | null = null;
let readReplicaDb: DbClient | null = null;

export interface DatabaseConnectionOptions {
  role?: DatabasePoolRole;
  max?: number;
}

let activePoolRole: DatabasePoolRole = "http";
let activeMaxPoolSize = 30;

export function getActivePoolRole(): DatabasePoolRole {
  return activePoolRole;
}

export function getActiveMaxPoolSize(): number {
  return activeMaxPoolSize;
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

export function getPool(): pg.Pool {
  if (!pool) throw new Error("Database pool not initialized");
  return pool;
}

/** Returns connection count telemetry for database health checks. */
export function getPoolMetrics(): PoolMetrics | null {
  return buildPoolMetrics(pool, readReplicaPool, activePoolRole);
}

/** Returns live per-tenant active transaction metrics and connection budget. */
export function getTenantDbMetrics(): TenantDbMetrics {
  return buildTenantDbMetrics(activeMaxPoolSize);
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
