import { Redis } from "ioredis";
import { logger } from "./logger.js";
import { clearInMemoryRedisFallback } from "./redisCacheOperations.js";

let redisInstance: Redis | null = null;
let isRedisConnected = false;

export function checkIsRedisConnected(): boolean {
  return isRedisConnected;
}

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
  clearInMemoryRedisFallback();
}

export * from "./redisKeys.js";
export * from "./redisBullMQ.js";
export * from "./redisCacheOperations.js";
export * from "./authRedisReads.js";
