import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  getOrSetMultiTier,
  getMultiTierCacheMetrics,
  resetMultiTierCacheMetrics,
  clearL1Cache,
  l1LruCache,
  buildCacheKey,
} from "../lib/cache/multiTierCache.js";
import {
  invalidateMultiTierCache,
  evictLocalL1Cache,
  CURRENT_NODE_ID,
  type CacheInvalidationMessage,
} from "../lib/cache/cacheInvalidation.js";
import { redisGet, redisSet, clearInMemoryRedisFallback } from "../lib/redis.js";

describe("Multi-Tier Caching Architecture (L1 LRU + L2 Redis)", () => {
  beforeEach(() => {
    clearL1Cache();
    clearInMemoryRedisFallback();
    resetMultiTierCacheMetrics();
  });

  it("serves L1 hits immediately with zero I/O and increments l1Hits metric", async () => {
    const tenantId = "tenant-a";
    const domain = "lookups";
    const key = "genders";
    const fullKey = buildCacheKey(tenantId, domain, key);

    // Pre-populate L1
    l1LruCache.set(fullKey, ["male", "female"]);

    const fetcher = vi.fn().mockResolvedValue(["fresh"]);
    const result = await getOrSetMultiTier(tenantId, domain, key, fetcher);

    expect(result).toEqual(["male", "female"]);
    expect(fetcher).not.toHaveBeenCalled();

    const metrics = getMultiTierCacheMetrics();
    expect(metrics.l1Hits).toBe(1);
    expect(metrics.l1Misses).toBe(0);
  });

  it("serves L2 Redis hits on L1 miss and populates L1 cache", async () => {
    const tenantId = "tenant-b";
    const domain = "config";
    const key = "theme";
    const fullKey = buildCacheKey(tenantId, domain, key);

    // Pre-populate L2 (in-memory Redis fallback in test environment)
    await redisSet(fullKey, JSON.stringify({ mode: "dark" }), 300);

    const fetcher = vi.fn().mockResolvedValue({ mode: "light" });
    const result = await getOrSetMultiTier(tenantId, domain, key, fetcher);

    expect(result).toEqual({ mode: "dark" });
    expect(fetcher).not.toHaveBeenCalled();

    const metrics = getMultiTierCacheMetrics();
    expect(metrics.l1Misses).toBe(1);
    expect(metrics.l2Hits).toBe(1);

    // Verify L1 is now populated
    expect(l1LruCache.has(fullKey)).toBe(true);
    expect(l1LruCache.get(fullKey)).toEqual({ mode: "dark" });
  });

  it("executes fetcher on cache miss and populates both L1 and L2", async () => {
    const tenantId = "tenant-c";
    const domain = "roles";
    const key = "teacher-perms";
    const fullKey = buildCacheKey(tenantId, domain, key);

    const fetcher = vi.fn().mockResolvedValue(["read:students", "write:attendance"]);
    const result = await getOrSetMultiTier(tenantId, domain, key, fetcher);

    expect(result).toEqual(["read:students", "write:attendance"]);
    expect(fetcher).toHaveBeenCalledTimes(1);

    const metrics = getMultiTierCacheMetrics();
    expect(metrics.l1Misses).toBe(1);
    expect(metrics.l2Misses).toBe(1);
    expect(metrics.sets).toBe(1);

    // Verify populated in both L1 and L2
    expect(l1LruCache.get(fullKey)).toEqual(["read:students", "write:attendance"]);
    const l2Raw = await redisGet(fullKey);
    expect(JSON.parse(l2Raw!)).toEqual(["read:students", "write:attendance"]);
  });

  it("prevents cache stampedes via single-flight Promise coalescing", async () => {
    const tenantId = "tenant-stampede";
    const domain = "expensive";
    const key = "report";

    let fetcherInvocationCount = 0;
    const slowFetcher = async () => {
      fetcherInvocationCount++;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { totalRevenue: 100000 };
    };

    // Launch 10 concurrent requests for the exact same uncached key
    const results = await Promise.all([
      getOrSetMultiTier(tenantId, domain, key, slowFetcher),
      getOrSetMultiTier(tenantId, domain, key, slowFetcher),
      getOrSetMultiTier(tenantId, domain, key, slowFetcher),
      getOrSetMultiTier(tenantId, domain, key, slowFetcher),
      getOrSetMultiTier(tenantId, domain, key, slowFetcher),
      getOrSetMultiTier(tenantId, domain, key, slowFetcher),
      getOrSetMultiTier(tenantId, domain, key, slowFetcher),
      getOrSetMultiTier(tenantId, domain, key, slowFetcher),
      getOrSetMultiTier(tenantId, domain, key, slowFetcher),
      getOrSetMultiTier(tenantId, domain, key, slowFetcher),
    ]);

    // All 10 requests receive the exact same resolved value
    for (const res of results) {
      expect(res).toEqual({ totalRevenue: 100000 });
    }

    // Crucially: slowFetcher was only invoked ONCE!
    expect(fetcherInvocationCount).toBe(1);

    const metrics = getMultiTierCacheMetrics();
    expect(metrics.inFlightCoalesced).toBe(9);
  });

  it("deterministically invalidates both L1 and L2 caches", async () => {
    const tenantId = "tenant-d";
    const domain = "lookups";
    const key = "tags";
    const fullKey = buildCacheKey(tenantId, domain, key);

    // Populate L1 and L2
    await getOrSetMultiTier(tenantId, domain, key, async () => ["VIP", "Alumni"]);
    expect(l1LruCache.has(fullKey)).toBe(true);
    expect(await redisGet(fullKey)).toBeTruthy();

    // Invalidate specific key
    await invalidateMultiTierCache({ tenantId, domain, key });

    // Assert evicted from both L1 and L2
    expect(l1LruCache.has(fullKey)).toBe(false);
    expect(await redisGet(fullKey)).toBeNull();
  });

  it("invalidates entire domain prefix from local L1 and L2", async () => {
    const tenantId = "tenant-e";
    const domain = "module-settings";
    const key1 = "color";
    const key2 = "layout";

    await getOrSetMultiTier(tenantId, domain, key1, async () => "blue");
    await getOrSetMultiTier(tenantId, domain, key2, async () => "grid");

    const fullKey1 = buildCacheKey(tenantId, domain, key1);
    const fullKey2 = buildCacheKey(tenantId, domain, key2);

    expect(l1LruCache.has(fullKey1)).toBe(true);
    expect(l1LruCache.has(fullKey2)).toBe(true);

    // Invalidate entire domain without key
    await invalidateMultiTierCache({ tenantId, domain });

    expect(l1LruCache.has(fullKey1)).toBe(false);
    expect(l1LruCache.has(fullKey2)).toBe(false);
  });

  it("evicts local L1 when receiving pub/sub message from another node", () => {
    const tenantId = "tenant-distributed";
    const domain = "configs";
    const key = "branding";
    const fullKey = buildCacheKey(tenantId, domain, key);

    l1LruCache.set(fullKey, { logo: "logo.png" });
    expect(l1LruCache.has(fullKey)).toBe(true);

    // Simulate pub/sub message originating from a different node
    const foreignNodeMessage: CacheInvalidationMessage = {
      tenantId,
      domain,
      key,
      senderNodeId: "foreign-node-uuid-1234",
      timestamp: Date.now(),
    };

    // Verify eviction logic triggers on foreign node message
    if (foreignNodeMessage.senderNodeId !== CURRENT_NODE_ID) {
      evictLocalL1Cache(
        foreignNodeMessage.tenantId,
        foreignNodeMessage.domain,
        foreignNodeMessage.key,
      );
    }

    expect(l1LruCache.has(fullKey)).toBe(false);
  });

  it("tracks l1Bytes heap consumption in metrics alongside l1Size", async () => {
    const tenantId = "tenant-bytes";
    const domain = "telemetry";
    const key = "payload";

    const result = await getOrSetMultiTier(tenantId, domain, key, async () => ({
      message: "Hello World",
      count: 42,
      active: true,
    }));

    expect(result).toEqual({ message: "Hello World", count: 42, active: true });

    const metrics = getMultiTierCacheMetrics();
    expect(metrics.l1Size).toBe(1);
    expect(metrics.l1Bytes).toBeGreaterThan(0);

    clearL1Cache();
    const clearedMetrics = getMultiTierCacheMetrics();
    expect(clearedMetrics.l1Size).toBe(0);
    expect(clearedMetrics.l1Bytes).toBe(0);
  });
});
