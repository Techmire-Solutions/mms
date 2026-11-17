import { describe, expect, it } from "vitest";
import {
  ALL_WORKSPACE_COLUMNS,
  clearWorkspaceCacheForTests,
  invalidateWorkspaceCache,
} from "../db/repositories/workspaceRepositoryCache.js";

describe("workspaceRepositoryCache", () => {
  it("projects all workspace columns including whatsAppNotifications", () => {
    expect(ALL_WORKSPACE_COLUMNS.whatsAppNotifications !== undefined).toBe(true);
    expect(ALL_WORKSPACE_COLUMNS.subdomain !== undefined).toBe(true);
  });

  it("handles cache invalidation and reset without throwing", () => {
    invalidateWorkspaceCache("demo");
    clearWorkspaceCacheForTests();
    expect(true).toBe(true);
  });
});
