import type { DehydratedState } from "@tanstack/react-query";

const DB_NAME = "mms_offline_cache";
const DB_VERSION = 1;
const STORE_NAME = "query_cache";
const CACHE_RECORD_KEY = "mms_dehydrated_state";
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface PersistedPayload {
  timestamp: number;
  clientState: DehydratedState;
}

export interface IdbPersisterOptions {
  maxAgeMs?: number;
  key?: string;
}

/**
 * One shared connection for the lifetime of the page.
 *
 * Every save/restore used to call `indexedDB.open` and never close the handle,
 * while `queryPersistenceLifecycle` subscribes saving to *every* cache event
 * (1s debounce). That leaked one connection per write for the whole session.
 */
let connectionPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  if (connectionPromise) return connectionPromise;

  connectionPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        // A version change in another tab invalidates this handle; drop the cache
        // so the next operation reopens instead of throwing NotFoundError.
        db.onversionchange = () => {
          db.close();
          connectionPromise = null;
        };
        db.onclose = () => {
          connectionPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        connectionPromise = null;
        resolve(null);
      };
    } catch {
      connectionPromise = null;
      resolve(null);
    }
  });

  return connectionPromise;
}

/** Test/teardown helper — closes the shared connection and forgets it. */
export function closeIdbConnection(): void {
  const pending = connectionPromise;
  connectionPromise = null;
  void pending?.then((db) => db?.close()).catch(() => undefined);
}

/**
 * Native IndexedDB cache persister for TanStack Query client state.
 * Allows instant offline read-hydration without synchronous 5MB localStorage limits.
 */
export function createIdbCachePersister(options?: IdbPersisterOptions) {
  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const storageKey = options?.key ?? CACHE_RECORD_KEY;

  return {
    async persistClient(clientState: DehydratedState): Promise<void> {
      const db = await openDatabase();
      if (!db) return;

      return new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const payload: PersistedPayload = {
            timestamp: Date.now(),
            clientState,
          };
          const putReq = store.put(payload, storageKey);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    },

    async restoreClient(): Promise<DehydratedState | undefined> {
      const db = await openDatabase();
      if (!db) return undefined;

      return new Promise<DehydratedState | undefined>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const getReq = store.get(storageKey);

          getReq.onsuccess = () => {
            const result = getReq.result as PersistedPayload | undefined;
            if (!result || !result.timestamp || !result.clientState) {
              resolve(undefined);
              return;
            }
            if (Date.now() - result.timestamp > maxAgeMs) {
              // Cache expired
              resolve(undefined);
              return;
            }
            resolve(result.clientState);
          };

          getReq.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      });
    },

    async removeClient(): Promise<void> {
      const db = await openDatabase();
      if (!db) return;

      return new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const delReq = store.delete(storageKey);
          delReq.onsuccess = () => resolve();
          delReq.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    },
  };
}
