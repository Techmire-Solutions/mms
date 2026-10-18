import { randomUUID } from "node:crypto";
import { l1LruCache, buildCacheKey } from "./multiTierCache.js";
import { getRedisClient, getRedisSubscriberClient, redisDel, redisDelPattern } from "../redis.js";
import { logger } from "../logger.js";

export const CACHE_INVALIDATION_CHANNEL = "mms:cache-invalidation";

export const CURRENT_NODE_ID = randomUUID();

export interface InvalidationParams {
  tenantId: string;
  domain: string;
  key?: string;
}

export interface CacheInvalidationMessage {
  tenantId: string;
  domain: string;
  key?: string;
  senderNodeId: string;
  timestamp: number;
}

/**
 * Evicts keys from the in-process L1 LRU cache.
 */
export function evictLocalL1Cache(tenantId: string, domain: string, key?: string): void {
  const normalizedTenant = tenantId.trim().toLowerCase();
  const normalizedDomain = domain.trim().toLowerCase();

  if (key) {
    const fullKey = buildCacheKey(normalizedTenant, normalizedDomain, key);
    l1LruCache.delete(fullKey);
    l1LruCache.delete(key);
  } else {
    // Evict all entries matching the tenant + domain prefix
    const prefix1 = `tenant:${normalizedTenant}:${normalizedDomain}:`;
    const prefix2 = `mms:${normalizedTenant}:setup:${normalizedDomain}:`;
    const prefix3 = `mms:${normalizedTenant}:${normalizedDomain}:`;
    for (const cachedKey of l1LruCache.keys()) {
      if (
        cachedKey.startsWith(prefix1) ||
        cachedKey.startsWith(prefix2) ||
        cachedKey.startsWith(prefix3)
      ) {
        l1LruCache.delete(cachedKey);
      }
    }
  }
}

/**
 * Deterministically invalidates both L1 (local + distributed via Redis pub/sub) and L2 Redis cache.
 * Guarantees zero stale cache entries across multi-instance deployments.
 */
export async function invalidateMultiTierCache(params: InvalidationParams): Promise<void> {
  const { tenantId, domain, key } = params;
  const normalizedTenant = tenantId.trim().toLowerCase();
  const normalizedDomain = domain.trim().toLowerCase();

  // 1. Evict from local L1 cache immediately
  evictLocalL1Cache(normalizedTenant, normalizedDomain, key);

  // 2. Evict from L2 Redis cache
  try {
    if (key) {
      const fullKey = buildCacheKey(normalizedTenant, normalizedDomain, key);
      await redisDel(fullKey);
    } else {
      const pattern = `tenant:${normalizedTenant}:${normalizedDomain}:*`;
      await redisDelPattern(pattern);
    }
  } catch (err) {
    logger.warn(
      { err, tenantId, domain, key },
      "Failed to delete from L2 Redis cache during invalidation",
    );
  }

  // 3. Publish cross-node invalidation event via Redis Pub/Sub
  const client = getRedisClient();
  if (client) {
    const payload: CacheInvalidationMessage = {
      tenantId: normalizedTenant,
      domain: normalizedDomain,
      key,
      senderNodeId: CURRENT_NODE_ID,
      timestamp: Date.now(),
    };
    try {
      await client.publish(CACHE_INVALIDATION_CHANNEL, JSON.stringify(payload));
    } catch (err) {
      logger.warn({ err, payload }, "Failed to publish cache invalidation event to Redis channel");
    }
  }
}

let isSubscriberInitialized = false;

/**
 * Initializes the Redis subscriber to listen for cross-node cache invalidation events.
 * Upon receiving an invalidation event from another backend node, evicts the matching keys from L1.
 */
export function initCacheInvalidationSubscriber(): () => void {
  if (isSubscriberInitialized) {
    return () => {};
  }

  const subscriber = getRedisSubscriberClient();
  if (!subscriber) {
    return () => {};
  }

  isSubscriberInitialized = true;

  const handleMessage = (channel: string, message: string) => {
    if (channel !== CACHE_INVALIDATION_CHANNEL) return;
    try {
      const payload = JSON.parse(message) as CacheInvalidationMessage;
      // Ignore invalidations originated by this exact node (already evicted locally)
      if (payload.senderNodeId === CURRENT_NODE_ID) return;

      evictLocalL1Cache(payload.tenantId, payload.domain, payload.key);
    } catch (err) {
      logger.warn({ err, message }, "Failed to process cache invalidation message from pub/sub");
    }
  };

  subscriber
    .subscribe(CACHE_INVALIDATION_CHANNEL, (err) => {
      if (err) {
        logger.warn({ err }, "Failed to subscribe to cache invalidation channel");
      }
    })
    .catch((err) => {
      logger.warn({ err }, "Failed to initiate cache invalidation subscription");
    });

  subscriber.on("message", handleMessage);

  return () => {
    try {
      subscriber.unsubscribe(CACHE_INVALIDATION_CHANNEL).catch(() => {});
      subscriber.off("message", handleMessage);
      isSubscriberInitialized = false;
    } catch {
      // Ignored during shutdown
    }
  };
}
