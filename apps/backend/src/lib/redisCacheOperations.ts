import { getRedisClient, checkIsRedisConnected } from "./redis.js";

// In-memory fallback map when Redis is not reachable or in non-Redis test runs (bounded to 5000 entries)
const IN_MEMORY_STORE_MAX_ENTRIES = 5000;
const inMemoryStore = new Map<string, { value: string; expiresAt?: number }>();

export async function redisGet(key: string): Promise<string | null> {
  const client = getRedisClient();
  if (client && checkIsRedisConnected()) {
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
  if (client && checkIsRedisConnected()) {
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
  if (client && checkIsRedisConnected()) {
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
  if (client && checkIsRedisConnected()) {
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
  if (client && checkIsRedisConnected()) {
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
  if (client && checkIsRedisConnected()) {
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
  if (client && checkIsRedisConnected()) {
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
  if (client && checkIsRedisConnected()) {
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
