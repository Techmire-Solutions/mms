import { LRUCache } from "lru-cache";
import { redisGet, redisSet } from "../redis.js";
import { logger } from "../logger.js";

export interface MultiTierCacheOptions {
  /** Time-to-live in seconds for L1 and L2 (default: 300s = 5m) */
  ttlSeconds?: number;
  /** Maximum number of items in L1 LRU cache (default: 5,000) */
  l1MaxItems?: number;
}

export interface MultiTierCacheMetrics {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  sets: number;
  evictions: number;
  inFlightCoalesced: number;
  l1Size: number;
  l1Bytes: number;
  hitRatio?: number;
}

const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_L1_MAX_ITEMS = 5000;
/** Hard heap-byte ceiling for L1 in-process LRU cache (50 MB) */
export const L1_MAX_HEAP_BYTES = 50 * 1024 * 1024;

/**
 * L1 entries are any non-nullish JSON-serialisable payload. `lru-cache`'s value
 * type parameter is constrained to `{}`, so `unknown` is not permitted here.
 */
export type CacheValue = NonNullable<unknown>;

// Shared L1 LRU Cache with item count and heap byte ceilings
export const l1LruCache = new LRUCache<string, CacheValue>({
  max: DEFAULT_L1_MAX_ITEMS,
  maxSize: L1_MAX_HEAP_BYTES,
  sizeCalculation: (value, key) => {
    try {
      if (value === null || value === undefined) return 64;
      if (typeof value === "string") return value.length * 2 + key.length * 2;
      if (typeof value === "number" || typeof value === "boolean") return 64;
      if (Buffer.isBuffer(value)) return value.byteLength + key.length * 2;
      return JSON.stringify(value).length * 2 + key.length * 2;
    } catch {
      return 1024;
    }
  },
  dispose: (_value, _key, reason) => {
    if (reason === "evict") {
      metrics.evictions++;
    }
  },
  ttl: DEFAULT_TTL_SECONDS * 1000,
  updateAgeOnGet: false,
  updateAgeOnHas: false,
});

// Single-flight coalescing map to protect against cache stampedes
const inFlightFetches = new Map<string, Promise<unknown>>();

// Performance Metrics
const metrics: MultiTierCacheMetrics = {
  l1Hits: 0,
  l1Misses: 0,
  l2Hits: 0,
  l2Misses: 0,
  sets: 0,
  evictions: 0,
  inFlightCoalesced: 0,
  get l1Size() {
    return l1LruCache.size;
  },
  get l1Bytes() {
    return l1LruCache.calculatedSize;
  },
};

/**
 * Constructs a standardized, tenant-isolated cache key:
 * Format: `tenant:<tenantId>:<domain>:<key>`
 */
export function buildCacheKey(tenantId: string, domain: string, key: string): string {
  if (key.startsWith("mms:") || key.startsWith("tenant:")) {
    return key;
  }
  const normalizedTenant = tenantId.trim().toLowerCase();
  const normalizedDomain = domain.trim().toLowerCase();
  const normalizedKey = key.trim();
  return `tenant:${normalizedTenant}:${normalizedDomain}:${normalizedKey}`;
}

/**
 * Multi-Tier Cache Getter with Cache Stampede Protection (Promise Coalescing).
 *
 * Flow:
 * 1. L1 LRU in-process lookup (0ms event loop latency, 0 I/O)
 * 2. L2 Redis lookup (sub-millisecond distributed cache)
 * 3. Cache Miss: Execute `fetcher()` with single-flight Promise coalescing
 * 4. Populate L1 + L2 asynchronously
 */
export async function getOrSetMultiTier<T>(
  tenantId: string,
  domain: string,
  key: string,
  fetcher: () => Promise<T>,
  options?: MultiTierCacheOptions,
): Promise<T> {
  const cacheKey = buildCacheKey(tenantId, domain, key);
  const ttlSeconds = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  // 1. Check L1 in-process LRU cache
  if (l1LruCache.has(cacheKey)) {
    metrics.l1Hits++;
    return l1LruCache.get(cacheKey) as T;
  }
  metrics.l1Misses++;

  // 2. Check L2 Redis cache
  try {
    const l2Cached = await redisGet(cacheKey);
    if (l2Cached !== null && l2Cached !== undefined) {
      metrics.l2Hits++;
      try {
        const parsed = JSON.parse(l2Cached) as T;
        // Populate L1 LRU cache
        l1LruCache.set(cacheKey, parsed as CacheValue, { ttl: ttlSeconds * 1000 });
        return parsed;
      } catch (err) {
        logger.warn({ err, cacheKey }, "Failed to parse JSON from L2 Redis cache; refreshing");
      }
    } else {
      metrics.l2Misses++;
    }
  } catch (err) {
    metrics.l2Misses++;
    logger.warn({ err, cacheKey }, "L2 Redis cache read error; bypassing to database fetcher");
  }

  // 3. Cache Stampede Protection: Coalesce concurrent in-flight fetches for the same key
  const existingFetch = inFlightFetches.get(cacheKey);
  if (existingFetch) {
    metrics.inFlightCoalesced++;
    return existingFetch as Promise<T>;
  }

  const fetchPromise = (async () => {
    try {
      const freshValue = await fetcher();

      // Populate L1 LRU cache
      l1LruCache.set(cacheKey, freshValue as CacheValue, { ttl: ttlSeconds * 1000 });

      // Populate L2 Redis cache asynchronously
      try {
        await redisSet(cacheKey, JSON.stringify(freshValue), ttlSeconds);
      } catch (err) {
        logger.warn({ err, cacheKey }, "Failed to populate L2 Redis cache");
      }

      metrics.sets++;
      return freshValue;
    } finally {
      inFlightFetches.delete(cacheKey);
    }
  })();

  inFlightFetches.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Returns current snapshot of multi-tier cache metrics.
 */
export function getMultiTierCacheMetrics(): MultiTierCacheMetrics {
  const totalLookups = metrics.l1Hits + metrics.l1Misses;
  const totalHits = metrics.l1Hits + metrics.l2Hits;
  const hitRatio = totalLookups > 0 ? Number((totalHits / totalLookups).toFixed(4)) : 0;

  return {
    ...metrics,
    hitRatio,
    l1Size: l1LruCache.size,
    l1Bytes: l1LruCache.calculatedSize,
  };
}

/**
 * Resets cache metrics (useful for testing).
 */
export function resetMultiTierCacheMetrics(): void {
  metrics.l1Hits = 0;
  metrics.l1Misses = 0;
  metrics.l2Hits = 0;
  metrics.l2Misses = 0;
  metrics.sets = 0;
  metrics.evictions = 0;
  metrics.inFlightCoalesced = 0;
}

/**
 * Clears the L1 LRU cache in-process (useful for testing or local eviction).
 */
export function clearL1Cache(): void {
  l1LruCache.clear();
  inFlightFetches.clear();
}
