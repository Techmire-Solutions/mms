import { describe, it, expect } from "vitest";
import { createIdbCachePersister } from "./idbCachePersister";
import type { DehydratedState } from "@tanstack/react-query";

describe("createIdbCachePersister", () => {
  it("instantiates with restore, persist, and remove interfaces", () => {
    const persister = createIdbCachePersister({ maxAgeMs: 3600000 });
    expect(typeof persister.persistClient).toBe("function");
    expect(typeof persister.restoreClient).toBe("function");
    expect(typeof persister.removeClient).toBe("function");
  });

  it("handles restoreClient gracefully when indexedDB is unavailable", async () => {
    const persister = createIdbCachePersister();
    const restored = await persister.restoreClient();
    expect(restored).toBeUndefined();
  });

  it("handles persistClient and removeClient gracefully without throwing", async () => {
    const persister = createIdbCachePersister();
    const dummyState: DehydratedState = {
      mutations: [],
      queries: [],
    };
    await expect(persister.persistClient(dummyState)).resolves.not.toThrow();
    await expect(persister.removeClient()).resolves.not.toThrow();
  });

  it("correctly persists and restores state through IndexedDB transactions", async () => {
    const memoryStore = new Map<string, unknown>();
    const mockDb = {
      transaction: () => ({
        objectStore: () => ({
          put: (val: unknown, key: string) => {
            memoryStore.set(key, val);
            const req = {
              onsuccess: null as (() => void) | null,
              onerror: null as (() => void) | null,
            };
            setTimeout(() => req.onsuccess?.(), 0);
            return req;
          },
          get: (key: string) => {
            const req = {
              result: memoryStore.get(key),
              onsuccess: null as (() => void) | null,
              onerror: null as (() => void) | null,
            };
            setTimeout(() => req.onsuccess?.(), 0);
            return req;
          },
          delete: (key: string) => {
            memoryStore.delete(key);
            const req = {
              onsuccess: null as (() => void) | null,
              onerror: null as (() => void) | null,
            };
            setTimeout(() => req.onsuccess?.(), 0);
            return req;
          },
        }),
      }),
    };

    const originalIndexedDB = globalThis.indexedDB;
    globalThis.indexedDB = {
      open: () => {
        const req = {
          result: mockDb,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
          onupgradeneeded: null as (() => void) | null,
        };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      },
    } as unknown as IDBFactory;

    try {
      const persister = createIdbCachePersister({ maxAgeMs: 5000 });
      const testState: DehydratedState = {
        mutations: [],
        queries: [
          {
            queryKey: ["test-key"],
            queryHash: '["test-key"]',
            state: {
              data: "sample-data",
              dataUpdatedAt: Date.now(),
              status: "success",
            } as unknown as never,
            dehydratedAt: Date.now(),
          },
        ],
      };

      await persister.persistClient(testState);
      const restored = await persister.restoreClient();
      expect(restored).toBeDefined();
      expect(restored?.queries[0].queryKey).toEqual(["test-key"]);

      await persister.removeClient();
      const afterRemove = await persister.restoreClient();
      expect(afterRemove).toBeUndefined();
    } finally {
      globalThis.indexedDB = originalIndexedDB;
    }
  });

  it("rejects expired cache payloads when maxAgeMs is exceeded", async () => {
    const memoryStore = new Map<string, unknown>();
    const mockDb = {
      transaction: () => ({
        objectStore: () => ({
          put: (val: unknown, key: string) => {
            memoryStore.set(key, val);
            const req = { onsuccess: null as (() => void) | null };
            setTimeout(() => req.onsuccess?.(), 0);
            return req;
          },
          get: (key: string) => {
            const req = {
              result: memoryStore.get(key),
              onsuccess: null as (() => void) | null,
            };
            setTimeout(() => req.onsuccess?.(), 0);
            return req;
          },
        }),
      }),
    };

    const originalIndexedDB = globalThis.indexedDB;
    globalThis.indexedDB = {
      open: () => {
        const req = {
          result: mockDb,
          onsuccess: null as (() => void) | null,
        };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      },
    } as unknown as IDBFactory;

    try {
      const persister = createIdbCachePersister({ maxAgeMs: 100 });
      // Store payload with timestamp 500ms in the past
      memoryStore.set("mms_dehydrated_state", {
        timestamp: Date.now() - 500,
        clientState: { mutations: [], queries: [] },
      });

      const restored = await persister.restoreClient();
      expect(restored).toBeUndefined();
    } finally {
      globalThis.indexedDB = originalIndexedDB;
    }
  });
});
