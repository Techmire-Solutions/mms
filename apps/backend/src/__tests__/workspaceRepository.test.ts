import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLimit = vi.fn().mockResolvedValue([]);
const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  transaction: vi.fn(async (cb) => cb(mockDb)),
  execute: vi.fn(),
};

vi.mock("@mms/db/client/db", () => ({
  getDb: () => mockDb,
}));

vi.mock("@mms/db/client/connection", () => ({
  activeDb: () => mockDb,
  getRootDb: () => mockDb,
  getReadReplicaDb: () => mockDb,
  hasActiveTransaction: () => false,
  // nested withTenant joins the ALS-registered transaction in production;
  // in these stubbed tests it runs the callback directly.
  withActiveTransaction: async (_tx: unknown, cb: () => Promise<unknown>) => await cb(),
}));

import {
  clearWorkspaceCacheForTests,
  deleteWorkspaceRow,
  findWorkspaceRowBySubdomain,
  insertWorkspaceRow,
  listWorkspaceRows,
  updateWorkspaceBrandingRow,
  updateWorkspaceEnabledRow,
  upsertWorkspaceBranding,
} from "../db/repositories/workspaceRepository.js";
import { DEFAULT_BRANDING_SETTINGS, type BrandingSettings } from "@mms/contracts";

describe("workspaceRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWorkspaceCacheForTests();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([]);
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
  });

  it("lists and maps workspace rows", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    mockFrom.mockResolvedValue([
      {
        id: "ws-1",
        subdomain: "demo",
        madrasaName: "Demo Madrasa",
        tagline: "Learning",
        country: "US",
        enabled: true,
        createdAt: now,
      },
    ]);

    const result = await listWorkspaceRows();
    expect(result).toEqual([
      {
        id: "ws-1",
        subdomain: "demo",
        madrasaName: "Demo Madrasa",
        tagline: "Learning",
        country: "US",
        enabled: true,
        createdAt: now.toISOString(),
      },
    ]);
  });

  it("finds workspace row by subdomain", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    mockLimit.mockResolvedValue([
      {
        id: "ws-1",
        subdomain: "demo",
        madrasaName: "Demo Madrasa",
        tagline: null,
        country: null,
        enabled: true,
        createdAt: now,
      },
    ]);

    const result = await findWorkspaceRowBySubdomain("demo");
    expect(result).toEqual({
      id: "ws-1",
      subdomain: "demo",
      madrasaName: "Demo Madrasa",
      tagline: undefined,
      country: undefined,
      enabled: true,
      createdAt: now.toISOString(),
    });
  });

  it("inserts new workspace row", async () => {
    await insertWorkspaceRow({
      id: "ws-2",
      subdomain: "dar-al-ilm",
      madrasaName: "Dar Al Ilm",
      tagline: "Knowledge",
      country: "UK",
    });

    expect(mockInsertValues).toHaveBeenCalledWith({
      id: "ws-2",
      subdomain: "dar-al-ilm",
      madrasaName: "Dar Al Ilm",
      tagline: "Knowledge",
      country: "UK",
      enabled: true,
    });
  });

  it("updates workspace enabled status", async () => {
    await updateWorkspaceEnabledRow("demo", false);
    expect(mockSet).toHaveBeenCalledWith({ enabled: false });
    expect(mockWhere).toHaveBeenCalled();
  });

  it("updates workspace branding", async () => {
    await updateWorkspaceBrandingRow("demo", {
      madrasaName: "  New Name  ",
      tagline: "  New Tagline  ",
    });
    expect(mockSet).toHaveBeenCalledWith({
      madrasaName: "New Name",
      tagline: "New Tagline",
    });
    expect(mockWhere).toHaveBeenCalled();
  });

  it("deletes workspace row", async () => {
    await deleteWorkspaceRow("demo");
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("stores the provisioning admin snapshot with the workspace row", async () => {
    await insertWorkspaceRow({
      id: "ws-3",
      subdomain: "al-noor",
      madrasaName: "Al-Noor Academy",
      provisionedAdmin: { name: "Ali Raza", email: "admin@alnoor.test", gender: "male" },
    });

    expect(mockInsertValues).toHaveBeenCalledWith({
      id: "ws-3",
      subdomain: "al-noor",
      madrasaName: "Al-Noor Academy",
      tagline: null,
      country: null,
      enabled: true,
      adminName: "Ali Raza",
      adminEmail: "admin@alnoor.test",
      adminGender: "male",
    });
  });

  it("never writes madrasa_name for tenant-scoped branding when preserveMadrasaName is set", async () => {
    await updateWorkspaceBrandingRow(
      "demo",
      { madrasaName: "Hijacked", tagline: "  New Tagline  " },
      { preserveMadrasaName: true },
    );
    expect(mockSet).toHaveBeenCalledWith({ tagline: "New Tagline" });

    mockSet.mockClear();
    await upsertWorkspaceBranding(
      "demo",
      { madrasaName: "Hijacked" } as Parameters<typeof upsertWorkspaceBranding>[1],
      { preserveMadrasaName: true },
    );
    const setArg = mockSet.mock.calls[0]![0] as Record<string, unknown>;
    expect(setArg).not.toHaveProperty("madrasaName");
    expect(setArg).toHaveProperty("tagline");
  });

  it("persists every institution field from BrandingSettings to its column", async () => {
    const branding: BrandingSettings = {
      ...DEFAULT_BRANDING_SETTINGS,
      madrasaName: "Al-Noor Academy",
      tagline: "Excellence in Islamic Education",
      primaryColor: "#123456",
      secondaryColor: "#654321",
      cornerStyle: "pill",
      logoUrl: "https://cdn.example.test/logo.png",
      faviconUrl: "https://cdn.example.test/favicon.png",
      footerText: "© Al-Noor Academy",
      email: "info@alnoor.test",
      phone: "+92 300 1234567",
      website: "https://alnoor.test",
      legalName: "Al-Noor Education Trust",
      registrationNumber: "REG-2026-0042",
      addressLine1: "12 Knowledge Road",
      addressLine2: "Block B",
      city: "Karachi",
      region: "Sindh",
      postalCode: "75500",
      country: "Pakistan",
      socialLinks: [
        { platform: "LinkedIn", url: "https://linkedin.com/company/al-noor" },
        { platform: "YouTube", url: "https://youtube.com/@alnoor" },
      ],
    };

    await upsertWorkspaceBranding("demo", branding);

    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith({
      madrasaName: "Al-Noor Academy",
      tagline: "Excellence in Islamic Education",
      primaryColor: "#123456",
      secondaryColor: "#654321",
      cornerStyle: "pill",
      logoUrl: "https://cdn.example.test/logo.png",
      faviconUrl: "https://cdn.example.test/favicon.png",
      footerText: "© Al-Noor Academy",
      email: "info@alnoor.test",
      phone: "+92 300 1234567",
      website: "https://alnoor.test",
      legalName: "Al-Noor Education Trust",
      registrationNumber: "REG-2026-0042",
      addressLine1: "12 Knowledge Road",
      addressLine2: "Block B",
      city: "Karachi",
      region: "Sindh",
      postalCode: "75500",
      country: "Pakistan",
      socialLinks: [
        { platform: "LinkedIn", url: "https://linkedin.com/company/al-noor" },
        { platform: "YouTube", url: "https://youtube.com/@alnoor" },
      ],
    });
    expect(mockWhere).toHaveBeenCalled();
  });
});
