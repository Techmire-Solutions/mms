import { describe, it, expect, beforeEach } from "vitest";
import { redisGet, redisSet, redisDelPattern } from "../lib/redis.js";
import { revokeUserSessionKeys } from "../services/authSessionService.js";
import { getWorkspaceBySubdomain, invalidateWorkspaceCache } from "../services/workspaceService.js";
import {
  loadGlobalSettings,
  invalidateGlobalSettingsCache,
} from "../services/globalSettingsService.js";

describe("Auth & Service Redis Caching (P10)", () => {
  beforeEach(async () => {
    await redisDelPattern("mms:*");
  });

  it("evicts user_active cache keys when revokeUserSessionKeys is called", async () => {
    const userId = "user-test-123";
    const activeKey1 = `mms:tenant1:user_active:${userId}:admin`;
    const activeKey2 = `mms:tenant2:user_active:${userId}:teacher`;
    const otherUserKey = `mms:tenant1:user_active:other-user:admin`;

    await redisSet(activeKey1, "active", 60);
    await redisSet(activeKey2, "active", 60);
    await redisSet(otherUserKey, "active", 60);

    expect(await redisGet(activeKey1)).toBe("active");
    expect(await redisGet(activeKey2)).toBe("active");
    expect(await redisGet(otherUserKey)).toBe("active");

    await revokeUserSessionKeys(userId);

    expect(await redisGet(activeKey1)).toBeNull();
    expect(await redisGet(activeKey2)).toBeNull();
    expect(await redisGet(otherUserKey)).toBe("active");
  });

  it("serves global settings from Redis and purges on invalidation", async () => {
    const tenant = "test-madrasa";
    const cacheKey = `mms:${tenant}:global_settings`;

    expect(await redisGet(cacheKey)).toBeNull();

    // Pre-populate cache directly
    const cachedSettings = { sessionTimeout: "45m", theme: "dark" as const };
    await redisSet(cacheKey, JSON.stringify(cachedSettings), 300);

    // loadGlobalSettings should hit the cache without calling DB
    const loaded = await loadGlobalSettings(tenant);
    expect(loaded.sessionTimeout).toBe("45m");
    expect(loaded.theme).toBe("dark");

    // Invalidate explicitly (called during mutation)
    await invalidateGlobalSettingsCache(tenant);

    // Cache key should have been evicted
    expect(await redisGet(cacheKey)).toBeNull();
  });

  it("serves workspace from Redis and purges on invalidation", async () => {
    const subdomain = "test-subdomain";
    const cacheKey = `mms:workspace:${subdomain}`;

    expect(await redisGet(cacheKey)).toBeNull();

    const mockWorkspace = {
      id: "ws-123",
      subdomain,
      name: "Test Subdomain",
      status: "active" as const,
      features: ["students"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await redisSet(cacheKey, JSON.stringify(mockWorkspace), 300);

    const fetched = await getWorkspaceBySubdomain(subdomain);
    expect(fetched).toEqual(mockWorkspace);

    // Invalidate explicitly (called during status/branding update)
    await invalidateWorkspaceCache(subdomain);

    expect(await redisGet(cacheKey)).toBeNull();
  });
});
