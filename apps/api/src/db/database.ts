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
// both DATABASE_URL and JWT_SECRET are already present: opt-in DB test suites
// load DATABASE_URL from `apps/api/.env` in `beforeAll`, and standalone scripts
// with only DATABASE_URL pre-exported would otherwise fail buildServerConfig().
if (process.env.DATABASE_URL && process.env.JWT_SECRET) {
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
