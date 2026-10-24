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
