import { describe, expect, it, vi } from "vitest";
import {
  CHUNK_LOAD_ERROR_EVENT,
  CHUNK_RELOAD_STORAGE_KEY,
  CHUNK_RELOAD_THROTTLE_MS,
  cleanupLegacyServiceWorkers,
  installChunkLoadRecovery,
  type ChunkLoadRecoveryDeps,
} from "./chunkLoadRecovery";

function createStorage(initial?: Record<string, string>): Pick<Storage, "getItem" | "setItem"> {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("chunkLoadRecovery (fe-core)", () => {
  it("purges stale static asset cache and updates SW registrations before reloading on preloadError", async () => {
    const target = new EventTarget();
    const reload = vi.fn();
    const update = vi.fn().mockResolvedValue(undefined);
    const deleteCache = vi.fn().mockResolvedValue(true);
    const storage = createStorage();

    const deps: ChunkLoadRecoveryDeps = {
      target,
      reload,
      now: () => 50_000,
      storage,
      serviceWorker: {
        getRegistrations: vi.fn().mockResolvedValue([{ update }]),
      },
      caches: {
        keys: vi.fn().mockResolvedValue(["mms-static-assets", "mms-html-manifest", "unrelated"]),
        delete: deleteCache,
      },
    };

    installChunkLoadRecovery(deps);
    const event = new Event(CHUNK_LOAD_ERROR_EVENT, { cancelable: true });
    target.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(storage.getItem(CHUNK_RELOAD_STORAGE_KEY)).toBe("50000");

    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalledTimes(1);
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith("mms-static-assets");
    expect(deleteCache).toHaveBeenCalledWith("mms-html-manifest");
    expect(deleteCache).not.toHaveBeenCalledWith("unrelated");
  });

  it("throttles repeated preloadError reloads within CHUNK_RELOAD_THROTTLE_MS", async () => {
    const target = new EventTarget();
    const reload = vi.fn();
    let clock = 100_000;
    const storage = createStorage();

    installChunkLoadRecovery({
      target,
      reload,
      now: () => clock,
      storage,
      serviceWorker: null,
      caches: null,
    });

    const first = new Event(CHUNK_LOAD_ERROR_EVENT, { cancelable: true });
    target.dispatchEvent(first);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    clock += CHUNK_RELOAD_THROTTLE_MS - 1;
    const second = new Event(CHUNK_LOAD_ERROR_EVENT, { cancelable: true });
    target.dispatchEvent(second);

    expect(second.defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("cleanupLegacyServiceWorkers unregisters all active registrations and wipes workbox/mms caches", async () => {
    const unregisterA = vi.fn().mockResolvedValue(true);
    const unregisterB = vi.fn().mockResolvedValue(true);
    const deleteCache = vi.fn().mockResolvedValue(true);

    await cleanupLegacyServiceWorkers({
      serviceWorker: {
        getRegistrations: vi
          .fn()
          .mockResolvedValue([{ unregister: unregisterA }, { unregister: unregisterB }]),
      },
      caches: {
        keys: vi
          .fn()
          .mockResolvedValue([
            "workbox-precache-v2-https://mmsv2.aabtaab.com/",
            "mms-static-assets",
            "mms-html-manifest",
            "keep-custom-cache",
          ]),
        delete: deleteCache,
      },
    });

    expect(unregisterA).toHaveBeenCalledTimes(1);
    expect(unregisterB).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith("workbox-precache-v2-https://mmsv2.aabtaab.com/");
    expect(deleteCache).toHaveBeenCalledWith("mms-static-assets");
    expect(deleteCache).toHaveBeenCalledWith("mms-html-manifest");
    expect(deleteCache).not.toHaveBeenCalledWith("keep-custom-cache");
  });
});
