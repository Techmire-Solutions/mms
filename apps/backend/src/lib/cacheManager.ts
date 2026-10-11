import {
  l1LruCache,
  getOrSetMultiTier,
  buildCacheKey,
  clearL1Cache,
  getMultiTierCacheMetrics,
  resetMultiTierCacheMetrics,
  L1_MAX_HEAP_BYTES,
  type CacheValue,
  type MultiTierCacheOptions,
  type MultiTierCacheMetrics,
} from "./cache/multiTierCache.js";
import {
  invalidateMultiTierCache,
  evictLocalL1Cache,
  initCacheInvalidationSubscriber,
  CACHE_INVALIDATION_CHANNEL,
  CURRENT_NODE_ID,
  type InvalidationParams,
} from "./cache/cacheInvalidation.js";
import { redisGet, redisSet, redisDel, redisDelPattern } from "./redis.js";

export {
  l1LruCache,
  getOrSetMultiTier,
  buildCacheKey,
  clearL1Cache,
  getMultiTierCacheMetrics,
  resetMultiTierCacheMetrics,
  L1_MAX_HEAP_BYTES,
  invalidateMultiTierCache,
  evictLocalL1Cache,
  initCacheInvalidationSubscriber,
  CACHE_INVALIDATION_CHANNEL,
  CURRENT_NODE_ID,
  type MultiTierCacheOptions,
  type MultiTierCacheMetrics,
  type InvalidationParams,
};

/**
 * Get an item from the multi-tier cache.
 * 1. Checks L1 (LRU in-memory).
 * 2. Checks L2 (Redis).
 * 3. Returns null if not found.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const l1Value = l1LruCache.get(key);
  if (l1Value !== undefined && l1Value !== null) {
    return l1Value as T;
  }

  const l2Value = await redisGet(key);
  if (l2Value !== null && l2Value !== undefined) {
    try {
      const parsed = JSON.parse(l2Value) as T;
      l1LruCache.set(key, parsed as CacheValue);
      return parsed;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Set an item in the multi-tier cache.
 * Updates L1 and L2.
 */
export async function setCached(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const ttlMs = ttlSeconds ? ttlSeconds * 1000 : undefined;
  l1LruCache.set(key, value as CacheValue, { ttl: ttlMs });

  const stringValue = JSON.stringify(value);
  await redisSet(key, stringValue, ttlSeconds);
}

/**
 * Get an item from the multi-tier cache, or execute the fetcher and cache the result.
 */
export async function getOrSetCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 300,
): Promise<T> {
  const cached = await getCached<T>(key);
  if (cached !== null && cached !== undefined) return cached;

  const value = await fetcher();
  await setCached(key, value, ttlSeconds);
  return value;
}

/**
 * Invalidates a specific key in both L1 and L2 caches, and broadcasts the invalidation.
 */
export async function invalidateCacheKey(key: string): Promise<void> {
  l1LruCache.delete(key);
  await redisDel(key);

  const parts = key.split(":");
  if (parts.length >= 4 && parts[0] === "tenant") {
    await invalidateMultiTierCache({
      tenantId: parts[1],
      domain: parts[2],
      key: parts.slice(3).join(":"),
    });
  } else {
    await invalidateMultiTierCache({
      tenantId: "global",
      domain: "raw",
      key,
    });
  }
}

/**
 * Invalidates keys matching a pattern in both L1 and L2 caches, and broadcasts the invalidation.
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  if (pattern === "*") {
    l1LruCache.clear();
  } else {
    const prefix = pattern.replace(/\*/g, "");
    for (const k of l1LruCache.keys()) {
      if (k.startsWith(prefix)) {
        l1LruCache.delete(k);
      }
    }
  }

  await redisDelPattern(pattern);

  const parts = pattern.split(":");
  if (parts.length >= 3 && parts[0] === "tenant") {
    await invalidateMultiTierCache({
      tenantId: parts[1],
      domain: parts[2],
    });
  }
}

// Ensure subscriber is initialized in non-test environments
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  initCacheInvalidationSubscriber();
}
