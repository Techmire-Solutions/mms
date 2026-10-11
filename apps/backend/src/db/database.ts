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
  runInReadSnapshotTransaction,
  runInTransaction,
  type DatabaseConnectionOptions,
  type DatabasePoolRole,
  type DbClient,
  type PoolMetrics,
} from "./dbConnection.js";
import { getDb, setDb } from "./dbClient.js";

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
