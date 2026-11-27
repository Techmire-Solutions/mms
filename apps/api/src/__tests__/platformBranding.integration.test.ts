import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLATFORM_BRANDING, DEFAULT_PLATFORM_SETTINGS } from "@mms/contracts";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

const { mockSuperUser } = vi.hoisted(() => ({
  mockSuperUser: {
    id: "p-super",
    email: "admin@platform.com",
    name: "Super Admin",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
    role: "super_user" as const,
    permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: true },
    sessionVersion: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
}));

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("@mms/mod-platform/backend/platform/repository/db/platformUserRepository", () => ({
  findPlatformUserRowById: vi.fn().mockResolvedValue(mockSuperUser),
  findPlatformUserRowByEmail: vi.fn().mockResolvedValue(mockSuperUser),
  listPlatformUsers: vi.fn().mockResolvedValue([mockSuperUser]),
  insertPlatformUser: vi.fn(),
  deletePlatformUserRow: vi.fn(),
}));

vi.mock("@mms/mod-platform/backend/platform/repository/db/platformActivityLogsRepository", () => ({
  insertPlatformActivityLog: vi.fn().mockResolvedValue(undefined),
}));

let currentBranding = {
  ...DEFAULT_PLATFORM_BRANDING,
  productName: "Acme Cloud",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

vi.mock("@mms/mod-platform/backend/platform/services/platformBrandingService", () => ({
  getPlatformBranding: vi.fn().mockImplementation(() => currentBranding),
  savePlatformAppearance: vi.fn().mockImplementation(async (input: Record<string, unknown>) => {
    if (input.expectedUpdatedAt === "stale") {
      return { ok: false, reason: "conflict" };
    }
    currentBranding = {
      ...currentBranding,
      ...((input.branding as Record<string, unknown> | undefined) ?? {}),
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    return {
      ok: true,
      branding: currentBranding,
      settings: {
        ...DEFAULT_PLATFORM_SETTINGS,
        themeMode: (input.themeMode as string | undefined) ?? "system",
      },
    };
  }),
  getPublicPlatformBrandingData: vi.fn().mockImplementation(() => ({
    branding: {
      productName: "Acme Cloud",
      consoleTitle: "Admin",
      tagline: "",
      logoUrl: "/uploads/branding/logo.webp",
      faviconUrl: "",
      primaryColor: "#123456",
      secondaryColor: "#654321",
      cornerStyle: "rounded",
      footerText: "",
    },
    themeMode: "dark",
    timezone: "UTC",
    dateFormat: "DD/MM/YYYY",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })),
}));

import { insertPlatformActivityLog } from "@mms/mod-platform/backend/platform/repository/db/platformActivityLogsRepository";

const mockAudit = vi.mocked(insertPlatformActivityLog);

describe("platform branding + public white-label routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  function token(): string {
    return app.jwt.sign({
      id: mockSuperUser.id,
      email: mockSuperUser.email,
      name: mockSuperUser.name,
      role: mockSuperUser.role,
      permissions: mockSuperUser.permissions,
      sessionVersion: mockSuperUser.sessionVersion,
      tokenType: "platform_access",
    });
  }

  it("returns branding for a settings super-user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/branding",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token() },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      branding: { productName: "Acme Cloud" },
    });
  });

  it("updates branding and records an audit event", async () => {
    mockAudit.mockClear();
    const res = await app.inject({
      method: "PUT",
      url: "/api/platform/branding",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token() },
      payload: {
        branding: { productName: "Acme Cloud Plus" },
        themeMode: "light",
        expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      success: true,
      branding: { productName: "Acme Cloud Plus" },
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update_platform_branding" }),
    );
  });

  it("returns 409 for a stale branding write", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/platform/branding",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token() },
      payload: { branding: { productName: "Stale" }, expectedUpdatedAt: "stale" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("rejects an unknown branding field (strict body)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/platform/branding",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token() },
      payload: { branding: { productName: "X", unexpected: true } },
    });
    expect(res.statusCode).toBe(400);
  });

  it("serves public branding without auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/public/platform-branding" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("no-cache");
    expect(JSON.parse(res.body)).toMatchObject({
      branding: { productName: "Acme Cloud" },
      themeMode: "dark",
    });
  });

  it("serves a white-labelled manifest with branding colours and icons", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/public/platform-manifest.webmanifest",
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/manifest+json");
    const body = JSON.parse(res.body) as {
      name: string;
      theme_color: string;
      icons: Array<{ src: string }>;
    };
    expect(body.name).toBe("Acme Cloud");
    expect(body.theme_color).toBe("#123456");
    expect(body.icons[0]?.src).toBe("/uploads/branding/logo.webp");
  });
});
