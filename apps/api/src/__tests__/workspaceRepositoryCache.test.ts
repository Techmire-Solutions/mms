import { describe, expect, it, vi } from "vitest";
import { runCommitScopedTransaction } from "@mms/db/client";
import * as dbClient from "@mms/db/client";
import {
  ALL_WORKSPACE_COLUMNS,
  clearWorkspaceCacheForTests,
  invalidateWorkspaceCache,
  loadWorkspaceRow,
} from "../db/repositories/workspaceRepositoryCache.js";

describe("workspaceRepositoryCache", () => {
  it("projects all workspace columns including whatsAppNotifications", () => {
    expect(ALL_WORKSPACE_COLUMNS.whatsAppNotifications !== undefined).toBe(true);
    expect(ALL_WORKSPACE_COLUMNS.subdomain !== undefined).toBe(true);
    // Provisioning-admin snapshot columns must stay in the projection: cached rows
    // feed the platform workspace list and inspector.
    for (const column of ["adminName", "adminEmail", "adminGender"] as const) {
      expect(ALL_WORKSPACE_COLUMNS[column] !== undefined).toBe(true);
    }
  });

  it("handles cache invalidation and reset without throwing", () => {
    invalidateWorkspaceCache("demo");
    clearWorkspaceCacheForTests();
    expect(true).toBe(true);
  });

  it("given an uncommitted transaction invalidates the cache and a concurrent reader repopulates the pre-commit row before commit, should evict the stale entry after commit", async () => {
    clearWorkspaceCacheForTests();
    let committedPhone: string | null = null;
    const activeDbSpy = vi.spyOn(dbClient, "activeDb").mockImplementation(
      () =>
        ({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [
                  {
                    id: "ws-1",
                    subdomain: "loginprobe",
                    madrasaName: "Test Madrasa",
                    phone: committedPhone,
                  },
                ],
              }),
            }),
          }),
        }) as unknown as ReturnType<typeof dbClient.activeDb>,
    );

    try {
      await runCommitScopedTransaction(async () => {
        // 1. Writer updates row in tx (not yet visible to outside pool connections) and invalidates cache.
        invalidateWorkspaceCache("loginprobe");
        // 2. Concurrent reader (e.g. GET /api/ws) queries outside tx BEFORE commit and populates stale row.
        const concurrentRead = await loadWorkspaceRow("loginprobe");
        expect(concurrentRead?.phone).toBeNull();
        // 3. Transaction commits: committed row now has phone populated.
        committedPhone = "03001234567";
      });

      // 4. Subsequent read after commit MUST see the committed row, not the poisoned pre-commit cache entry.
      const postCommitRead = await loadWorkspaceRow("loginprobe");
      expect(postCommitRead?.phone).toBe("03001234567");
    } finally {
      activeDbSpy.mockRestore();
      clearWorkspaceCacheForTests();
    }
  });
});
