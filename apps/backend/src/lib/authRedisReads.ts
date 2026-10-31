import { checkIsRedisConnected, getRedisClient } from "./redis.js";
import {
  redisBatch,
  redisExists,
  redisGet,
  type RedisBatchOp,
  type RedisBatchResult,
} from "./redisCacheOperations.js";

/** Raised by the strict read variants when Redis is configured but unavailable. */
export class RedisUnavailableError extends Error {
  constructor(message = "Redis is required for session validation but is unavailable") {
    super(message);
    this.name = "RedisUnavailableError";
  }
}

/**
 * True when the deployment relies on Redis for shared auth state.
 *
 * Local/dev/test runs without a configured Redis keep the in-memory fallback so
 * the unit suite (and a single-node developer install) still works; a deployment
 * that sets `REDIS_URL` gets fail-closed behaviour.
 */
export function isAuthRedisRequired(): boolean {
  return (
    Boolean(process.env.REDIS_URL?.trim()) && process.env.NODE_ENV !== "test" && !process.env.VITEST
  );
}

export async function redisGetStrict(key: string): Promise<string | null> {
  if (!isAuthRedisRequired()) return redisGet(key);
  const client = getRedisClient();
  if (!client || !checkIsRedisConnected()) throw new RedisUnavailableError();
  try {
    return await client.get(key);
  } catch {
    throw new RedisUnavailableError();
  }
}

export async function redisExistsStrict(key: string): Promise<boolean> {
  if (!isAuthRedisRequired()) return redisExists(key);
  const client = getRedisClient();
  if (!client || !checkIsRedisConnected()) throw new RedisUnavailableError();
  try {
    return (await client.exists(key)) > 0;
  } catch {
    throw new RedisUnavailableError();
  }
}

export async function redisBatchStrict(ops: RedisBatchOp[]): Promise<RedisBatchResult> {
  if (ops.length === 0) return [];
  if (!isAuthRedisRequired()) return redisBatch(ops);

  const client = getRedisClient();
  if (!client || !checkIsRedisConnected()) throw new RedisUnavailableError();
  try {
    const pipeline = client.pipeline();
    for (const op of ops) {
      if (op.type === "exists") pipeline.exists(op.key);
      else pipeline.get(op.key);
    }
    const results = await pipeline.exec();
    if (!results) throw new RedisUnavailableError();
    return results.map(([err, res], i) => {
      if (err) throw new RedisUnavailableError();
      const op = ops[i];
      if (op.type === "exists") return (res as number) > 0;
      return res as string | null;
    });
  } catch (error) {
    if (error instanceof RedisUnavailableError) throw error;
    throw new RedisUnavailableError();
  }
}
