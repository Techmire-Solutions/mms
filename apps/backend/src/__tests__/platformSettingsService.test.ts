import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "../services/platform/platformSettingsService.js";

vi.mock("../db/dbClient.js", () => {
  const mockRows: Record<string, unknown>[] = [];
  const mockDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => mockRows,
        }),
      }),
    }),
    insert: () => ({
      values: (val: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: async () => [val],
        }),
        onConflictDoUpdate: async () => [val],
      }),
    }),
  };
  return {
    getDb: () => mockDb,
  };
});

vi.mock("../db/dbConnection.js", () => {
  const mockRows: Record<string, unknown>[] = [];
  const mockDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => mockRows,
        }),
      }),
    }),
    insert: () => ({
      values: (val: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: async () => [val],
        }),
        onConflictDoUpdate: async () => [val],
      }),
    }),
  };
  return {
    getRootDb: () => mockDb,
    activeDb: () => mockDb,
    hasActiveTransaction: () => false,
    withActiveTransaction: (_tx: unknown, cb: <T>() => T) => cb(),
  };
});

describe("platformSettingsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns platform settings and updates cache on update", async () => {
    const initial = getPlatformSettings();
    expect(initial.id).toBe("global");

    const updated = await updatePlatformSettings({
      certbotEmail: "admin@example.com",
      syncTlsOnCreate: true,
      tlsExtraSans: "*.example.com",
    });

    expect(updated.certbotEmail).toBe("admin@example.com");
    expect(updated.syncTlsOnCreate).toBe(true);
    expect(updated.tlsExtraSans).toBe("*.example.com");

    const cached = getPlatformSettings();
    expect(cached.certbotEmail).toBe("admin@example.com");
  });
});
