import { describe, it, expect, vi, beforeEach } from "vitest";
import { pgTable, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { clearInMemoryRedisFallback, redisGet } from "../lib/redis.js";
import { clearL1Cache } from "../lib/cache/index.js";
import { createWorkspaceSingletonJsonRepo } from "../db/repositories/moduleSetupRepoSingletonJson.js";
import { createModuleLookupsRepo } from "../db/repositories/moduleSetupRepoLookups.js";

const mockWithTenant = vi.fn();
vi.mock("../db/tenant-context.js", () => ({
  withTenant: (tenant: string, fn: (tx: unknown) => Promise<unknown>) => mockWithTenant(tenant, fn),
  withTenantRead: (tenant: string, fn: (tx: unknown) => Promise<unknown>) =>
    mockWithTenant(tenant, fn),
}));

describe("Setup Repositories Redis Caching & Invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearInMemoryRedisFallback();
    clearL1Cache();
  });

  describe("createWorkspaceSingletonJsonRepo", () => {
    const fakeTable = pgTable("test_module_preferences", {
      workspaceSubdomain: text("workspace_subdomain").notNull(),
      preferences: jsonb("preferences").notNull(),
      updatedAt: timestamp("updated_at").notNull(),
    });

    it("caches getByWorkspace in Redis and serves cache on second call", async () => {
      const repo = createWorkspaceSingletonJsonRepo({
        table: fakeTable,
        jsonColumn: "preferences",
      });

      const dbData = { theme: "dark", pageSize: 50 };
      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ preferences: dbData }],
            }),
          }),
        }),
      };

      mockWithTenant.mockImplementation(async (_tenant, fn) => fn(mockTx));

      // First call hits DB
      const result1 = await repo.getByWorkspace("demo");
      expect(result1).toEqual(dbData);
      expect(mockWithTenant).toHaveBeenCalledTimes(1);

      // Verify cached in Redis fallback
      const cached = await redisGet("mms:demo:setup:test_module_preferences:preferences");
      expect(cached).toBe(JSON.stringify(dbData));

      // Second call serves from Redis without hitting DB
      const result2 = await repo.getByWorkspace("demo");
      expect(result2).toEqual(dbData);
      expect(mockWithTenant).toHaveBeenCalledTimes(1);
    });

    it("invalidates cache on upsert", async () => {
      const repo = createWorkspaceSingletonJsonRepo({
        table: fakeTable,
        jsonColumn: "preferences",
      });

      const dbData = { theme: "dark", pageSize: 50 };
      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ preferences: dbData }],
            }),
          }),
        }),
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: async () => {},
          }),
        }),
      };

      mockWithTenant.mockImplementation(async (_tenant, fn) => fn(mockTx));

      // Populate cache
      await repo.getByWorkspace("demo");
      expect(await redisGet("mms:demo:setup:test_module_preferences:preferences")).toBeTruthy();

      // Upsert new data
      await repo.upsert("demo", { theme: "light", pageSize: 25 });

      // Cache should be evicted
      expect(await redisGet("mms:demo:setup:test_module_preferences:preferences")).toBeNull();
    });
  });

  describe("createModuleLookupsRepo", () => {
    const fakeTable = pgTable("test_module_lookups", {
      id: text("id").primaryKey(),
      workspaceSubdomain: text("workspace_subdomain").notNull(),
      kind: text("kind").notNull(),
      label: text("label").notNull(),
      meta: jsonb("meta"),
      sortOrder: integer("sort_order").notNull(),
      updatedAt: timestamp("updated_at").notNull(),
    });

    it("caches listByKind and evicts on replaceForKind", async () => {
      const repo = createModuleLookupsRepo({ table: fakeTable });

      const lookupRows = [{ id: "1", kind: "department", label: "Math", sortOrder: 0 }];
      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: async () => lookupRows,
            }),
          }),
        }),
        delete: () => ({
          where: async () => {},
        }),
        insert: () => ({
          values: async () => {},
        }),
      };

      mockWithTenant.mockImplementation(async (_tenant, fn) => fn(mockTx));

      // First call
      const res1 = await repo.listByKind("demo", "department");
      expect(res1).toEqual(lookupRows);
      expect(mockWithTenant).toHaveBeenCalledTimes(1);

      // Verify cached
      const cacheKey = "mms:demo:setup:test_module_lookups:kind:department";
      expect(await redisGet(cacheKey)).toBeTruthy();

      // Second call hits cache
      const res2 = await repo.listByKind("demo", "department");
      expect(res2).toEqual(lookupRows);
      expect(mockWithTenant).toHaveBeenCalledTimes(1);

      // Mutate
      await repo.replaceForKind("demo", "department", [
        { id: "2", kind: "department", label: "Science", sortOrder: 0 },
      ]);

      // Cache pattern evicted
      expect(await redisGet(cacheKey)).toBeNull();
    });
  });
});
