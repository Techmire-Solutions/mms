import { Redis } from "ioredis";
import { logger } from "./logger.js";

let redisInstance: Redis | null = null;
let isRedisConnected = false;

export function checkIsRedisConnected(): boolean {
  return isRedisConnected;
}

// In-memory fallback map when Redis is not reachable or in non-Redis test runs (bounded to 5000 entries)
const IN_MEMORY_STORE_MAX_ENTRIES = 5000;
const inMemoryStore = new Map<string, { value: string; expiresAt?: number }>();

export function getRedisClient(): Redis | null {
  if (redisInstance) return redisInstance;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl && (process.env.NODE_ENV === "test" || process.env.VITEST)) {
    return null;
  }

  try {
    const url = redisUrl || "redis://127.0.0.1:6379";
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 5000,
      commandTimeout: 5000,
      keepAlive: 30000,
      disconnectTimeout: 2000,
      autoResendUnfulfilledCommands: false,
      // Never give up: returning null permanently disables reconnection, so a
      // brief Redis restart would freeze this process (cache + revocation
      // checks) until it was restarted by hand.
      retryStrategy(times: number) {
        return Math.min(times * 150 + Math.floor(Math.random() * 75), 30_000);
      },
      reconnectOnError(err: Error) {
        return err.message.includes("READONLY");
      },
    });

    client.on("ready", () => {
      isRedisConnected = true;
    });

    client.on("close", () => {
      isRedisConnected = false;
    });

    client.on("error", (err: Error) => {
      isRedisConnected = false;
      if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
        logger.warn({ err: err.message }, "Redis connection warning");
      }
    });

    client.connect().catch(() => {
      isRedisConnected = false;
    });

    redisInstance = client;
    return redisInstance;
  } catch {
    isRedisConnected = false;
    return null;
  }
}

let redisRateLimitInstance: Redis | null = null;
let isRateLimitRedisConnected = false;

export function checkIsRateLimitRedisConnected(): boolean {
  return isRateLimitRedisConnected;
}

export function getRateLimitRedisClient(): Redis | null {
  if (redisRateLimitInstance) return redisRateLimitInstance;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl && (process.env.NODE_ENV === "test" || process.env.VITEST)) {
    return null;
  }

  try {
    const url = redisUrl || "redis://127.0.0.1:6379";
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 5000,
      commandTimeout: 5000,
      keepAlive: 30000,
      disconnectTimeout: 2000,
      retryStrategy(times: number) {
        return Math.min(times * 150 + Math.floor(Math.random() * 75), 30_000);
      },
    });

    client.on("ready", () => {
      isRateLimitRedisConnected = true;
    });

    client.on("close", () => {
      isRateLimitRedisConnected = false;
    });

    client.on("error", (err: Error) => {
      isRateLimitRedisConnected = false;
      if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
        logger.warn({ err: err.message }, "Redis rate-limit connection warning");
      }
    });

    client.connect().catch(() => {
      isRateLimitRedisConnected = false;
    });

    redisRateLimitInstance = client;
    return redisRateLimitInstance;
  } catch {
    isRateLimitRedisConnected = false;
    return null;
  }
}

let redisSubscriberInstance: Redis | null = null;

export function getRedisSubscriberClient(): Redis | null {
  if (redisSubscriberInstance) return redisSubscriberInstance;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl && (process.env.NODE_ENV === "test" || process.env.VITEST)) {
    return null;
  }

  try {
    const url = redisUrl || "redis://127.0.0.1:6379";
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 5000,
      commandTimeout: 5000,
      keepAlive: 30000,
      disconnectTimeout: 2000,
      autoResubscribe: true,
      // Never give up: returning null permanently disables reconnection, so a
      // brief Redis restart would freeze this process (cache + revocation
      // checks) until it was restarted by hand.
      retryStrategy(times: number) {
        return Math.min(times * 150 + Math.floor(Math.random() * 75), 30_000);
      },
    });

    client.on("error", (err: Error) => {
      if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
        logger.warn({ err: err.message }, "Redis subscriber connection warning");
      }
    });

    client.connect().catch(() => {});

    redisSubscriberInstance = client;
    return redisSubscriberInstance;
  } catch {
    return null;
  }
}

export async function redisGet(key: string): Promise<string | null> {
  const client = getRedisClient();
  if (client && isRedisConnected) {
    try {
      return await client.get(key);
    } catch {
      // Fallback to in-memory on error
    }
  }

  const entry = inMemoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    inMemoryStore.delete(key);
    return null;
  }
  return entry.value;
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const client = getRedisClient();
  if (client && isRedisConnected) {
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(key, value, "EX", ttlSeconds);
      } else {
        await client.set(key, value);
      }
      return;
    } catch {
      // Fallback to in-memory
    }
  }

  const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined;
  if (inMemoryStore.size >= IN_MEMORY_STORE_MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, entry] of inMemoryStore.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        inMemoryStore.delete(k);
      }
    }
    if (inMemoryStore.size >= IN_MEMORY_STORE_MAX_ENTRIES) {
      const oldestKey = inMemoryStore.keys().next().value;
      if (oldestKey) inMemoryStore.delete(oldestKey);
    }
  }
  inMemoryStore.set(key, { value, expiresAt });
}

export async function redisIncr(key: string, ttlSeconds?: number): Promise<number> {
  const client = getRedisClient();
  if (client && isRedisConnected) {
    try {
      const val = await client.incr(key);
      if (ttlSeconds && ttlSeconds > 0) {
        await client.expire(key, ttlSeconds);
      }
      return val;
    } catch {
      // Fallback to in-memory on error
    }
  }

  const now = Date.now();
  const entry = inMemoryStore.get(key);
  let currentNum = 0;
  if (entry && (!entry.expiresAt || now <= entry.expiresAt)) {
    currentNum = Number.parseInt(entry.value, 10) || 0;
  }
  const nextNum = currentNum + 1;
  const expiresAt = ttlSeconds && ttlSeconds > 0 ? now + ttlSeconds * 1000 : undefined;
  inMemoryStore.set(key, { value: String(nextNum), expiresAt });
  return nextNum;
}

export async function redisDecr(key: string, ttlSeconds?: number): Promise<number> {
  const client = getRedisClient();
  if (client && isRedisConnected) {
    try {
      const luaScript = `
        local val = redis.call('DECR', KEYS[1])
        if val <= 0 then
          redis.call('DEL', KEYS[1])
          return 0
        else
          if ARGV[1] and tonumber(ARGV[1]) > 0 then
            redis.call('EXPIRE', KEYS[1], ARGV[1])
          end
          return val
        end
      `;
      const result = await client.eval(luaScript, 1, key, ttlSeconds ? String(ttlSeconds) : "0");
      return Number(result) || 0;
    } catch {
      // Fallback to in-memory on error
    }
  }

  const now = Date.now();
  const entry = inMemoryStore.get(key);
  let currentNum = 0;
  if (entry && (!entry.expiresAt || now <= entry.expiresAt)) {
    currentNum = Number.parseInt(entry.value, 10) || 0;
  }
  const nextNum = Math.max(0, currentNum - 1);
  if (nextNum === 0) {
    inMemoryStore.delete(key);
  } else {
    const expiresAt = ttlSeconds && ttlSeconds > 0 ? now + ttlSeconds * 1000 : entry?.expiresAt;
    inMemoryStore.set(key, { value: String(nextNum), expiresAt });
  }
  return nextNum;
}

export async function redisDel(key: string): Promise<void> {
  if (key.includes("*")) {
    return redisDelPattern(key);
  }
  const client = getRedisClient();
  if (client && isRedisConnected) {
    try {
      await client.del(key);
    } catch {
      // Fallback to in-memory
    }
  }
  inMemoryStore.delete(key);
}

export async function redisDelPattern(pattern: string): Promise<void> {
  const client = getRedisClient();
  if (client && isRedisConnected) {
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 200);
        cursor = nextCursor;
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } while (cursor !== "0");
    } catch {
      // Fallback to in-memory
    }
  }

  if (!pattern.includes("*")) {
    inMemoryStore.delete(pattern);
  } else if (pattern.endsWith("*") && !pattern.slice(0, -1).includes("*")) {
    const prefix = pattern.slice(0, -1);
    for (const key of inMemoryStore.keys()) {
      if (key.startsWith(prefix)) {
        inMemoryStore.delete(key);
      }
    }
  } else {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const regex = new RegExp(`^${escaped}$`);
    for (const key of inMemoryStore.keys()) {
      if (regex.test(key)) {
        inMemoryStore.delete(key);
      }
    }
  }
}

export async function redisExists(key: string): Promise<boolean> {
  const client = getRedisClient();
  if (client && isRedisConnected) {
    try {
      const res = await client.exists(key);
      return res > 0;
    } catch {
      // Fallback to in-memory
    }
  }

  const entry = inMemoryStore.get(key);
  if (!entry) return false;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    inMemoryStore.delete(key);
    return false;
  }
  return true;
}

export type RedisBatchOp = { key: string; type: "exists" } | { key: string; type: "get" };

export type RedisBatchResult = Array<boolean | string | null>;

function inMemoryBatchOp(op: RedisBatchOp): boolean | string | null {
  const entry = inMemoryStore.get(op.key);
  if (!entry) return op.type === "exists" ? false : null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    inMemoryStore.delete(op.key);
    return op.type === "exists" ? false : null;
  }
  return op.type === "exists" ? true : entry.value;
}

/**
 * Runs a batch of independent Redis reads (EXISTS / GET) in a single
 * round-trip via a pipeline. Falls back to the in-memory store per-op when
 * Redis is unavailable. Results are returned in the same order as `ops`.
 */
export async function redisBatch(ops: RedisBatchOp[]): Promise<RedisBatchResult> {
  if (ops.length === 0) return [];
  const client = getRedisClient();
  if (client && isRedisConnected) {
    try {
      const pipeline = client.pipeline();
      for (const op of ops) {
        if (op.type === "exists") pipeline.exists(op.key);
        else pipeline.get(op.key);
      }
      const results = await pipeline.exec();
      if (results) {
        return results.map(([err, res], i) => {
          if (err) return inMemoryBatchOp(ops[i]);
          const op = ops[i];
          if (op.type === "exists") return (res as number) > 0;
          return res as string | null;
        });
      }
    } catch {
      // fall through to in-memory
    }
  }
  return ops.map(inMemoryBatchOp);
}

export function clearInMemoryRedisFallback(): void {
  inMemoryStore.clear();
}

/**
 * Gracefully disconnects all active Redis client connections.
 */
export async function disconnectRedis(): Promise<void> {
  const safeQuit = async (client: Redis) => {
    try {
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Redis quit timeout")), 2000);
      });
      try {
        await Promise.race([client.quit(), timeoutPromise]);
      } finally {
        clearTimeout(timeoutId!);
      }
    } catch {
      client.disconnect();
    }
  };

  if (redisInstance) {
    await safeQuit(redisInstance);
    redisInstance = null;
  }
  if (redisSubscriberInstance) {
    await safeQuit(redisSubscriberInstance);
    redisSubscriberInstance = null;
  }
  if (redisRateLimitInstance) {
    await safeQuit(redisRateLimitInstance);
    redisRateLimitInstance = null;
  }
  isRedisConnected = false;
  isRateLimitRedisConnected = false;
  inMemoryStore.clear();
}

export interface BullMQConnectionOptions {
  host: string;
  port: number;
  password?: string;
  username?: string;
  maxRetriesPerRequest: null;
  enableReadyCheck: boolean;
  connectTimeout: number;
  keepAlive: number;
  disconnectTimeout: number;
  retryStrategy: (times: number) => number;
}

/**
 * SSOT connection options for BullMQ queues and workers.
 * Enforces `maxRetriesPerRequest: null` and aggressive reconnect backoff.
 */
export function getBullMQConnectionOptions(): BullMQConnectionOptions {
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname || "127.0.0.1",
      port: url.port ? Number.parseInt(url.port, 10) : 6379,
      password: url.password || undefined,
      username: url.username || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      connectTimeout: 5000,
      keepAlive: 30000,
      disconnectTimeout: 2000,
      retryStrategy(times: number) {
        return Math.min(times * 150 + Math.floor(Math.random() * 50), 30_000);
      },
    };
  } catch {
    return {
      host: "127.0.0.1",
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      connectTimeout: 5000,
      keepAlive: 30000,
      disconnectTimeout: 2000,
      retryStrategy(times: number) {
        return Math.min(times * 150 + Math.floor(Math.random() * 50), 30_000);
      },
    };
  }
}

/**
 * Centralized Redis cache keys and pub/sub channel names (SSOT).
 */
export const redisKeys = {
  workspace: (subdomain: string) => `mms:workspace:${subdomain.trim().toLowerCase()}`,
  globalSettings: (tenant: string) => `mms:${tenant.trim().toLowerCase()}:global_settings`,
  userActive: (tenant: string, userId: string, role: string) =>
    `mms:${tenant.trim().toLowerCase()}:user_active:${userId}:${role}`,
  userActivePattern: (userId: string) => `mms:*:user_active:${userId}:*`,
  sessionPattern: (userId: string) => `mms:session:${userId}:*`,
  setupSingleton: (tenant: string, tableName: string, jsonColumn: string) =>
    `mms:${tenant.trim().toLowerCase()}:setup:${tableName}:${jsonColumn}`,
  setupLookupsAll: (tenant: string, tableName: string) =>
    `mms:${tenant.trim().toLowerCase()}:setup:${tableName}:all`,
  setupLookupsKind: (tenant: string, tableName: string, kind: string) =>
    `mms:${tenant.trim().toLowerCase()}:setup:${tableName}:kind:${kind}`,
  setupPattern: (tenant: string, tableName: string) =>
    `mms:${tenant.trim().toLowerCase()}:setup:${tableName}:*`,
  metrics: (tenant: string, collection: string) =>
    `mms:${tenant.trim().toLowerCase()}:${collection}:metrics`,
  metricsPattern: (tenant: string, collection: string) =>
    `mms:${tenant.trim().toLowerCase()}:${collection}*:metrics`,
  dashboardSummary: (tenant: string, date?: string) =>
    `mms:${tenant.trim().toLowerCase()}:dashboard:summary:${date ?? "today"}`,
  dashboardSummaryPattern: (tenant: string) =>
    `mms:${tenant.trim().toLowerCase()}:dashboard:summary:*`,
  searchVersion: (tenant: string, entityType: string, entityId: string) =>
    `mms:${tenant.trim().toLowerCase()}:search:version:${entityType}:${entityId}`,
  entityPattern: (tenant: string, entityType: string) =>
    `mms:${tenant.trim().toLowerCase()}:${entityType}:*`,
  wsInvalidationChannel: "mms:ws-invalidation" as const,
  jobEventChannel: "mms:job-event" as const,
};
