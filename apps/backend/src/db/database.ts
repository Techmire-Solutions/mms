import {
  activeDb,
  closeDatabase,
  getActivePoolRole,
  getPool,
  getPoolMetrics,
  getReadReplicaDb,
  getRootDb,
  hasActiveTransaction,
  initializeDatabaseConnection,
  pingDatabase,
  runInGlobalReadSnapshotTransaction,
  runInGlobalTransaction,
  runInReadSnapshotTransaction,
  runInTransaction,
  type DatabaseConnectionOptions,
  type DatabasePoolRole,
  type DbClient,
  type PoolMetrics,
} from "@mms/db/client";
import { configureDbConfig } from "@mms/db";
import { getDb, setDb } from "@mms/db/client";
import { loadServerConfig } from "../config/serverConfig.js";

// Hand the validated server config to the data layer so pool sizing, statement
// timeouts and the read replica match the rest of the process exactly. Only when
// DATABASE_URL is already present: the opt-in DB test suites load it from
// `apps/backend/.env` in `beforeAll`, and pinning a fallback here would win over
// that later assignment. `@mms/db` resolves the same values from env per call.
if (process.env.DATABASE_URL) {
  const serverConfig = loadServerConfig();
  configureDbConfig({
    databaseUrl: serverConfig.databaseUrl,
    readReplicaDatabaseUrl: serverConfig.readReplicaDatabaseUrl,
    pgPoolMax: serverConfig.pgPoolMax,
    pgStatementTimeoutMs: serverConfig.pgStatementTimeoutMs,
    pgIdleInTxTimeoutMs: serverConfig.pgIdleInTxTimeoutMs,
    isProd: serverConfig.isProd,
  });
}

export interface DatabaseHealth {
  status: "healthy" | "unhealthy";
  pool: PoolMetrics | null;
}

export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  const isConnected = await pingDatabase();
  const poolMetrics = getPoolMetrics();
  return {
    status: isConnected ? "healthy" : "unhealthy",
    pool: poolMetrics,
  };
}

export {
  activeDb,
  closeDatabase,
  getActivePoolRole,
  getDb,
  getPool,
  getPoolMetrics,
  getReadReplicaDb,
  getRootDb,
  hasActiveTransaction,
  initializeDatabaseConnection,
  pingDatabase,
  runInGlobalReadSnapshotTransaction,
  runInGlobalTransaction,
  runInReadSnapshotTransaction,
  runInTransaction,
  setDb,
  type DatabaseConnectionOptions,
  type DatabasePoolRole,
  type DbClient,
  type PoolMetrics,
};

export {
  deleteCollectionByStorageName,
  deleteCollection,
  deleteObject,
  deleteObjectByStorageKey,
  getAllData,
  getCollection,
  getCollectionByStorageName,
  getCollectionForUpdate,
  getObject,
  getObjectByStorageKey,
  listCollectionStorageNames,
  listObjectStorageKeys,
  listTenantObjectLogicalKeys,
  listTenantCollectionLogicalKeys,
  saveCollection,
  saveObject,
  type SaveCollectionOptions,
} from "./documentStore.js";
export { initDb, resetDbInitStateForTesting, seedDatabase } from "./dbInit.js";
export { purgeTenantDataBySubdomain, resetTenantData } from "./dbPurge.js";
