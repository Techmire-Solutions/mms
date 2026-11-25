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

const mockDb = { select: mockSelect, insert: mockInsert };

vi.mock("@mms/db/client/db", () => ({
  getDb: () => mockDb,
}));

vi.mock("@mms/db/client/connection", () => ({
  activeDb: () => mockDb,
  getRootDb: () => mockDb,
  getReadReplicaDb: () => mockDb,
  hasActiveTransaction: () => false,
  withActiveTransaction: async (_tx: unknown, cb: () => Promise<unknown>) => await cb(),
}));

import {
  findPlatformBrandingRow,
  GLOBAL_BRANDING_ID,
  upsertPlatformBrandingRow,
} from "../db/repositories/platformBrandingRepository.js";
import { DEFAULT_PLATFORM_BRANDING, mergePlatformBranding } from "@mms/contracts";

describe("platformBrandingRepository", () => {
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

  it("maps a stored row into merged platform branding", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    mockLimit.mockResolvedValue([
      {
        ...DEFAULT_PLATFORM_BRANDING,
        id: GLOBAL_BRANDING_ID,
        productName: "Acme",
        consoleTitle: "Admin",
        primaryColor: "#123456",
        cornerStyle: "soft",
        socialLinks: [{ platform: "LinkedIn", url: "https://linkedin.com/acme" }],
        updatedAt: now,
      },
    ]);

    const result = await findPlatformBrandingRow();
    expect(result?.productName).toBe("Acme");
    expect(result?.consoleTitle).toBe("Admin");
    expect(result?.primaryColor).toBe("#123456");
    expect(result?.updatedAt).toBe(now.toISOString());
  });

  it("persists and returns the merged branding record", async () => {
    const next = mergePlatformBranding({ productName: "Acme Cloud", primaryColor: "#abcdef" });
    const result = await upsertPlatformBrandingRow(next);

    expect(result.productName).toBe("Acme Cloud");
    expect(result.primaryColor).toBe("#abcdef");
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        productName: "Acme Cloud",
        primaryColor: "#abcdef",
      }),
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
  });

  it("returns null when no branding row exists yet", async () => {
    mockLimit.mockResolvedValue([]);
    await expect(findPlatformBrandingRow()).resolves.toBeNull();
  });
});
