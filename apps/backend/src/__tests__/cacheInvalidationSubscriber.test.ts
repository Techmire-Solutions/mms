import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeSubscriber = {
  subscribe: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => ({
  subscriber: null as FakeSubscriber | null,
  redisDel: vi.fn(),
  redisDelPattern: vi.fn(),
}));

vi.mock("../lib/redis.js", () => ({
  getRedisClient: () => null,
  getRedisSubscriberClient: () => mocks.subscriber,
  redisDel: mocks.redisDel,
  redisDelPattern: mocks.redisDelPattern,
}));

function makeSubscriber(): FakeSubscriber {
  return {
    subscribe: vi.fn((_channel: string, callback?: (err: Error | null) => void) => {
      callback?.(null);
      return Promise.resolve();
    }),
    on: vi.fn(),
    off: vi.fn(),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  };
}

describe("cache invalidation subscriber startup", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.subscriber = null;
  });

  it("subscribes once from the production bootstrap path", async () => {
    mocks.subscriber = makeSubscriber();
    const { startCacheInvalidationSubscriber, hasCacheInvalidationSubscriber } =
      await import("../lib/cache/cacheInvalidation.js");

    expect(startCacheInvalidationSubscriber()).toBe(true);
    expect(mocks.subscriber.subscribe).toHaveBeenCalledTimes(1);
    expect(mocks.subscriber.subscribe).toHaveBeenCalledWith(
      "mms:cache-invalidation",
      expect.any(Function),
    );
    expect(hasCacheInvalidationSubscriber()).toBe(true);

    // Idempotent: a second boot-time call must not register a duplicate listener.
    expect(startCacheInvalidationSubscriber()).toBe(true);
    expect(mocks.subscriber.subscribe).toHaveBeenCalledTimes(1);
  });

  it("reports an unavailable subscriber instead of pretending invalidation works", async () => {
    const { startCacheInvalidationSubscriber, hasCacheInvalidationSubscriber } =
      await import("../lib/cache/cacheInvalidation.js");

    expect(startCacheInvalidationSubscriber()).toBe(false);
    expect(hasCacheInvalidationSubscriber()).toBe(false);
  });
});
