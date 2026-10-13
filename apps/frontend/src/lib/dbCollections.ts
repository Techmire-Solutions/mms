import { validateSessions } from "@/lib/data/sessionsData";
import { applyTitleCaseRecursive } from "@mms/shared";
import {
  dispatchLocalDatabaseUpdate,
  safeSetItem,
  scopedStorageKey,
  syncToServer,
} from "@/lib/dbStorageCore";
import { reportClientError, reportClientWarn } from "@/lib/clientErrorReporting";
import { hydrateLinkedCollection, normalizeLinkedCollection } from "@/lib/dbLinkHydration";

export const DOCUMENT_STORE_COLLECTIONS = new Set(["currencies", "backups"]);
const BUSINESS_COLLECTIONS = DOCUMENT_STORE_COLLECTIONS;

/**
 * Checks if a collection key exists in local storage.
 *
 * @param {string} key - The collection key.
 * @returns {boolean} True if the collection exists in cache.
 */
export function hasCollectionInCache(key: string): boolean {
  try {
    return localStorage.getItem(scopedStorageKey(key)) !== null;
  } catch {
    return false;
  }
}

/**
 * Saves a collection ONLY to local storage (does not sync to server).
 * Used when caching data that was fetched from the server.
 *
 * @template T
 * @param {string} key - Unique key for storage.
 * @param {T[]} collectionItems - Collection items to save.
 * @returns {void}
 */
export function saveCollectionCacheOnly<T>(key: string, collectionItems: T[]): void {
  try {
    const sanitized: unknown[] =
      key === "sessions" ? validateSessions(collectionItems) : collectionItems;
    const normalized = normalizeLinkedCollection(key, sanitized);
    const dataToSave = applyTitleCaseRecursive(normalized);
    safeSetItem(scopedStorageKey(key), JSON.stringify(dataToSave));
    dispatchLocalDatabaseUpdate();
  } catch (error) {
    reportClientError(error, { context: "db.saveCollectionCache", key });
  }
}

/**
 * Retrieves a collection from localStorage. If not found, seeds it with the provided default data.
 *
 * @template T
 * @param {string} key - Unique key for storage.
 * @param {T[]} defaultData - Fallback data used if the collection does not exist.
 * @returns {T[]} The loaded collection.
 */
export function getCollection<T = unknown>(key: string, defaultData: T[] = [] as T[]): T[] {
  try {
    const saved = localStorage.getItem(scopedStorageKey(key));
    if (saved !== null && saved !== "undefined") {
      try {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) {
          let collection: unknown[] = parsed;
          if (key === "sessions") {
            collection = validateSessions(collection);
          }
          collection = hydrateLinkedCollection(key, collection);
          return collection as T[];
        }
      } catch (error) {
        reportClientWarn(error, { context: "db.parseCachedCollection", key });
      }
    }
    const isAuth = typeof window !== "undefined" && localStorage.getItem("mms_user") !== null;
    if (isAuth && BUSINESS_COLLECTIONS.has(key)) {
      return [] as T[];
    }
    if (defaultData.length === 0) {
      return [];
    }
    const sanitized: unknown[] = key === "sessions" ? validateSessions(defaultData) : defaultData;
    const dataToSave = normalizeLinkedCollection(key, sanitized);
    safeSetItem(scopedStorageKey(key), JSON.stringify(dataToSave));

    // Defer so reads during render (e.g. useLiveCollection init) don't update other components synchronously
    if (DOCUMENT_STORE_COLLECTIONS.has(key)) {
      queueMicrotask(() => {
        void syncToServer(`/api/db/collections/${key}`, dataToSave);
      });
    }

    let seedData: unknown[] = hydrateLinkedCollection(key, dataToSave);
    if (key === "sessions") {
      seedData = validateSessions(seedData);
      seedData = hydrateLinkedCollection(key, seedData);
    }
    return seedData as T[];
  } catch (error) {
    reportClientError(error, { context: "db.getCollection", key });
    return defaultData;
  }
}

/**
 * Saves a collection to localStorage and synchronizes in background with backend.
 *
 * @template T
 * @param {string} key - Unique key for storage.
 * @param {T[]} collectionItems - Collection items to save.
 * @returns {void}
 */
export function saveCollection<T>(key: string, collectionItems: T[]): void {
  try {
    const sanitized: unknown[] =
      key === "sessions" ? validateSessions(collectionItems) : collectionItems;
    const normalized = normalizeLinkedCollection(key, sanitized);
    const dataToSave = applyTitleCaseRecursive(normalized);
    safeSetItem(scopedStorageKey(key), JSON.stringify(dataToSave));
    dispatchLocalDatabaseUpdate();

    // Sync to backend asynchronously only for supported document-store collections
    if (DOCUMENT_STORE_COLLECTIONS.has(key)) {
      void syncToServer(`/api/db/collections/${key}`, dataToSave);
    }
  } catch (error) {
    reportClientError(error, { context: "db.saveCollection", key });
  }
}

/**
 * Saves a collection locally and waits for `/api/db/collections/:key` sync.
 * Throws when the server rejects the write.
 */
export async function saveCollectionAsync<T>(key: string, collectionItems: T[]): Promise<void> {
  const sanitized: unknown[] =
    key === "sessions" ? validateSessions(collectionItems) : collectionItems;
  const normalized = normalizeLinkedCollection(key, sanitized);
  const dataToSave = applyTitleCaseRecursive(normalized);
  safeSetItem(scopedStorageKey(key), JSON.stringify(dataToSave));
  dispatchLocalDatabaseUpdate();

  if (DOCUMENT_STORE_COLLECTIONS.has(key)) {
    const result = await syncToServer(`/api/db/collections/${key}`, dataToSave);
    if (!result.ok) {
      throw new Error(`Failed to sync collection "${key}"`);
    }
  }
}

/**
 * Retrieves a single object/record from localStorage. If not found, seeds it.
 *
 * @template T
 * @param {string} key - Unique key for storage.
 * @param {T} defaultData - Fallback data.
 * @returns {T} The loaded object.
 */
