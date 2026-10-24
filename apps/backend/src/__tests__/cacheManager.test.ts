import { describe, expect, it, beforeEach } from "vitest";
import {
  getCached,
  setCached,
  getOrSetCached,
  invalidateCacheKey,
  invalidateCachePattern,
  l1LruCache,
  clearL1Cache,
  getMultiTierCacheMetrics,
  resetMultiTierCacheMetrics,
} from "../lib/cacheManager.js";

describe("cacheManager facade", () => {
  beforeEach(() => {
    clearL1Cache();
    resetMultiTierCacheMetrics();
  });

  it("stores and retrieves items via L1 cache", async () => {
    await setCached("tenant:madrasa-1:config:theme", { primary: "emerald" }, 60);

    const cached = await getCached<{ primary: string }>("tenant:madrasa-1:config:theme");
    expect(cached).toEqual({ primary: "emerald" });
    expect(l1LruCache.has("tenant:madrasa-1:config:theme")).toBe(true);
  });

  it("returns null for missing cache keys", async () => {
    const missing = await getCached("tenant:madrasa-1:nonexistent:key");
    expect(missing).toBeNull();
  });

  it("getOrSetCached fetches on miss and caches for subsequent calls", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { count: callCount, name: "cached-data" };
    };

    const first = await getOrSetCached("tenant:madrasa-1:data:test", fetcher, 60);
    expect(first).toEqual({ count: 1, name: "cached-data" });
    expect(callCount).toBe(1);

    const second = await getOrSetCached("tenant:madrasa-1:data:test", fetcher, 60);
    expect(second).toEqual({ count: 1, name: "cached-data" });
    expect(callCount).toBe(1); // Not called again
  });

  it("invalidateCacheKey removes key from L1 LRU cache", async () => {
    await setCached("tenant:madrasa-1:domain:item1", { id: 1 }, 60);
    expect(l1LruCache.has("tenant:madrasa-1:domain:item1")).toBe(true);

    await invalidateCacheKey("tenant:madrasa-1:domain:item1");
    expect(l1LruCache.has("tenant:madrasa-1:domain:item1")).toBe(false);
  });

  it("invalidateCachePattern removes matching keys by prefix", async () => {
    await setCached("tenant:madrasa-1:settings:a", "1", 60);
    await setCached("tenant:madrasa-1:settings:b", "2", 60);
    await setCached("tenant:madrasa-2:settings:c", "3", 60);

    await invalidateCachePattern("tenant:madrasa-1:settings:*");

    expect(l1LruCache.has("tenant:madrasa-1:settings:a")).toBe(false);
    expect(l1LruCache.has("tenant:madrasa-1:settings:b")).toBe(false);
    expect(l1LruCache.has("tenant:madrasa-2:settings:c")).toBe(true);
  });

  it("exposes multi-tier metrics from unified cache", () => {
    const metrics = getMultiTierCacheMetrics();
    expect(metrics).toBeDefined();
    expect(typeof metrics.l1Hits).toBe("number");
    expect(typeof metrics.l1Misses).toBe("number");
    expect(typeof metrics.l1Bytes).toBe("number");
  });
});
