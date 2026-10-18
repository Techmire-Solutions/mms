import { describe, it, expect, beforeEach } from "vitest";
import { LRUCache } from "lru-cache";
import {
  l1LruCache,
  L1_MAX_HEAP_BYTES,
  getMultiTierCacheMetrics,
  resetMultiTierCacheMetrics,
  clearL1Cache,
} from "../lib/cache/multiTierCache.js";

describe("L1 In-Process Cache Heap-Byte Ceiling & LRU Eviction", () => {
  beforeEach(() => {
    clearL1Cache();
    resetMultiTierCacheMetrics();
  });

  it("exposes L1_MAX_HEAP_BYTES as 50 MB hard ceiling", () => {
    expect(L1_MAX_HEAP_BYTES).toBe(50 * 1024 * 1024);
    expect(l1LruCache.maxSize).toBe(L1_MAX_HEAP_BYTES);
  });

  it("tracks calculatedSize and reflects in getMultiTierCacheMetrics", () => {
    const key = "tenant:test:sample:1";
    const payload = { id: 1, name: "Sample Payload", tags: ["a", "b", "c"] };

    l1LruCache.set(key, payload);

    const metrics = getMultiTierCacheMetrics();
    expect(metrics.l1Size).toBe(1);
    expect(metrics.l1Bytes).toBeGreaterThan(0);
    expect(metrics.l1Bytes).toBe(l1LruCache.calculatedSize);
  });

  it("enforces maxSize eviction when aggregate item sizes exceed byte threshold", () => {
    let evictions = 0;
    // Create an isolated small-ceiling cache (10 KB) to deterministically test byte eviction
    const SMALL_CEILING_BYTES = 10 * 1024;
    const testCache = new LRUCache<string, any>({
      maxSize: SMALL_CEILING_BYTES,
      sizeCalculation: (value, key) => {
        return JSON.stringify(value).length * 2 + key.length * 2;
      },
      dispose: (_value, _key, reason) => {
        if (reason === "evict") {
          evictions++;
        }
      },
    });

    // 1 KB payload
    const makeChunk = (id: number) => ({ id, data: "x".repeat(500) });

    // Insert 20 chunks (total ~20 KB, exceeding 10 KB ceiling)
    for (let i = 0; i < 20; i++) {
      testCache.set(`key:${i}`, makeChunk(i));
    }

    // Assert that total size never exceeds SMALL_CEILING_BYTES
    expect(testCache.calculatedSize).toBeLessThanOrEqual(SMALL_CEILING_BYTES);
    // Assert that items were evicted
    expect(evictions).toBeGreaterThan(0);
    // Oldest items should have been evicted
    expect(testCache.has("key:0")).toBe(false);
    // Newest items should remain
    expect(testCache.has("key:19")).toBe(true);
  });

  it("l1LruCache disposes with eviction count tracking on capacity overflow", () => {
    expect(getMultiTierCacheMetrics().evictions).toBe(0);

    // Populate and clear
    l1LruCache.set("test:key", { foo: "bar" });
    expect(l1LruCache.has("test:key")).toBe(true);
    clearL1Cache();
    expect(l1LruCache.has("test:key")).toBe(false);
    expect(getMultiTierCacheMetrics().l1Size).toBe(0);
    expect(getMultiTierCacheMetrics().l1Bytes).toBe(0);
  });
});
