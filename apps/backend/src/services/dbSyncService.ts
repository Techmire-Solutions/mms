import {
  getCollection as dbGetCollection,
  saveCollection as dbSaveCollection,
  getObject as dbGetObject,
  saveObject as dbSaveObject,
  resetTenantData as dbResetTenantData,
} from "../db/database.js";

export { fetchDatabaseSnapshot, fetchBackupSnapshot } from "./dbSyncSnapshotService.js";

export { synchronizeData } from "./dbSyncRestoreService.js";

/**
 * Resets the current tenant to minimal defaults (scoped; does not drop global tables).
 */
export async function resetToDefaults(): Promise<void> {
  await dbResetTenantData();
}

/**
 * Retrieves a specific collection by name.
 *
 * @param {string} name - The collection name.
 * @returns {Promise<unknown[] | null>} The collection contents or null.
 */
export async function fetchCollection(name: string): Promise<unknown[] | null> {
  return await dbGetCollection(name);
}

/**
 * Persists a collection by name.
 *
 * @param {string} name - The collection name.
 * @param {unknown[]} collectionItems - The collection documents.
 * @returns {Promise<void>}
 */
export async function persistCollection(name: string, collectionItems: unknown[]): Promise<void> {
  // JSON document store only — never wipe REST-migrated relational tables.
  await dbSaveCollection(name, collectionItems);
}

/**
 * Retrieves a specific key-value object by key.
 *
 * @param {string} key - The object identifier.
 * @returns {Promise<unknown | null>} The object value or null.
 */
export async function fetchObject(key: string): Promise<unknown | null> {
  return await dbGetObject(key);
}

/**
 * Persists a key-value object by key.
 *
 * @param {string} key - The object identifier.
 * @param {unknown} objectValue - The object value data.
 * @returns {Promise<void>}
 */
export async function persistObject(key: string, objectValue: unknown): Promise<void> {
  await dbSaveObject(key, objectValue);
}
