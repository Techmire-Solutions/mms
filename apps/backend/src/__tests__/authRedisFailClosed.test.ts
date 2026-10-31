import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/redis.js", () => ({
  getRedisClient: () => null,
  checkIsRedisConnected: () => false,
}));

import {
  RedisUnavailableError,
  isAuthRedisRequired,
  redisBatchStrict,
  redisExistsStrict,
  redisGetStrict,
} from "../lib/authRedisReads.js";

describe("strict auth Redis reads", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the in-memory fallback when Redis is not configured", async () => {
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(isAuthRedisRequired()).toBe(false);
    await expect(redisGetStrict("missing")).resolves.toBeNull();
    await expect(redisExistsStrict("missing")).resolves.toBe(false);
  });

  it("fails closed when Redis is configured but unreachable", async () => {
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379");
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(isAuthRedisRequired()).toBe(true);
    await expect(redisGetStrict("session:revoked:j1")).rejects.toBeInstanceOf(
      RedisUnavailableError,
    );
    await expect(redisExistsStrict("session:revoked:j1")).rejects.toBeInstanceOf(
      RedisUnavailableError,
    );
    await expect(
      redisBatchStrict([{ key: "tenant:blocked:demo", type: "exists" }]),
    ).rejects.toBeInstanceOf(RedisUnavailableError);
  });

  it("never fails closed in the unit-test environment", async () => {
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379");
    vi.stubEnv("VITEST", "true");
    vi.stubEnv("NODE_ENV", "test");

    expect(isAuthRedisRequired()).toBe(false);
    await expect(redisGetStrict("missing")).resolves.toBeNull();
  });
});
