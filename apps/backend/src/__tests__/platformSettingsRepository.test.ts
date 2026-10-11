import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLimit = vi.fn();
const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

const mockReturning = vi.fn();
const mockOnConflictDoNothing = vi.fn().mockReturnValue({ returning: mockReturning });
const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([]);
const mockInsertValues = vi.fn().mockReturnValue({
  onConflictDoNothing: mockOnConflictDoNothing,
  onConflictDoUpdate: mockOnConflictDoUpdate,
});
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
};

vi.mock("../db/dbClient.js", () => ({
  getDb: () => mockDb,
}));

vi.mock("../db/dbConnection.js", () => ({
  activeDb: () => mockDb,
  getRootDb: () => mockDb,
  getReadReplicaDb: () => mockDb,
  hasActiveTransaction: () => false,
  // nested withTenant joins the ALS-registered transaction in production;
  // in these stubbed tests it runs the callback directly.
  withActiveTransaction: async (_tx: unknown, cb: () => Promise<unknown>) => await cb(),
}));

import {
  findPlatformSettingsRow,
  insertPlatformSettingsDefaultRow,
  upsertPlatformSettingsRow,
  GLOBAL_SETTINGS_ID,
} from "../db/repositories/platformSettingsRepository.js";

describe("platformSettingsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({
      onConflictDoNothing: mockOnConflictDoNothing,
      onConflictDoUpdate: mockOnConflictDoUpdate,
    });
  });

  describe("findPlatformSettingsRow", () => {
    it("returns formatted settings when row exists", async () => {
      const now = new Date("2026-01-01T00:00:00.000Z");
      mockLimit.mockResolvedValue([
        {
          id: GLOBAL_SETTINGS_ID,
          syncTlsOnCreate: true,
          tlsExtraSans: "*.madrasa.local",
          certbotEmail: "admin@madrasa.local",
          updatedAt: now,
        },
      ]);

      const result = await findPlatformSettingsRow();
      expect(result).toEqual({
        id: GLOBAL_SETTINGS_ID,
        syncTlsOnCreate: true,
        tlsExtraSans: "*.madrasa.local",
        certbotEmail: "admin@madrasa.local",
        updatedAt: now.toISOString(),
      });
    });

    it("returns null when row does not exist", async () => {
      mockLimit.mockResolvedValue([]);
      const result = await findPlatformSettingsRow();
      expect(result).toBeNull();
    });
  });

  describe("insertPlatformSettingsDefaultRow", () => {
    it("inserts and returns formatted default row", async () => {
      const now = new Date("2026-01-01T00:00:00.000Z");
      mockReturning.mockResolvedValue([
        {
          id: GLOBAL_SETTINGS_ID,
          syncTlsOnCreate: false,
          tlsExtraSans: "",
          certbotEmail: "",
          updatedAt: now,
        },
      ]);

      const result = await insertPlatformSettingsDefaultRow({
        syncTlsOnCreate: false,
        tlsExtraSans: "",
        certbotEmail: "",
      });

      expect(result).toEqual({
        id: GLOBAL_SETTINGS_ID,
        syncTlsOnCreate: false,
        tlsExtraSans: "",
        certbotEmail: "",
        updatedAt: now.toISOString(),
      });
    });
  });

  describe("upsertPlatformSettingsRow", () => {
    it("persists and returns updated platform settings", async () => {
      const current = {
        id: GLOBAL_SETTINGS_ID,
        syncTlsOnCreate: true,
        tlsExtraSans: "*.old.local",
        certbotEmail: "old@madrasa.local",
        emailNotifications: true,
        smsNotifications: false,
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const result = await upsertPlatformSettingsRow(
        {
          certbotEmail: "new@madrasa.local",
          tlsExtraSans: "*.new.local",
        },
        current,
      );

      expect(result.certbotEmail).toBe("new@madrasa.local");
      expect(result.tlsExtraSans).toBe("*.new.local");
      expect(result.syncTlsOnCreate).toBe(true);
      expect(mockInsertValues).toHaveBeenCalled();
      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    });
  });
});
