import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

const { mockSuperUser, mockAdminUser } = vi.hoisted(() => {
  const mockSuperUser = {
    id: "p-super",
    email: "admin@platform.com",
    name: "Super Admin",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
    role: "super_user" as const,
    permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: true },
    sessionVersion: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  const mockAdminUser = {
    id: "p-admin",
    email: "normal-settings-test@platform.com",
    name: "Normal Admin",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
    role: "admin" as const,
    permissions: {
      workspaces: false,
      onboard: false,
      settings: false,
      admins: false,
      system: false,
    },
    sessionVersion: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  return { mockSuperUser, mockAdminUser };
});

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../db/repositories/platformUserRepository.js", () => ({
  findPlatformUserRowById: vi.fn().mockImplementation(async (id: string) => {
    if (id === "p-super") return mockSuperUser;
    if (id === "p-admin") return mockAdminUser;
    return null;
  }),
  findPlatformUserRowByEmail: vi.fn().mockImplementation(async (email: string) => {
    if (email === "admin@platform.com") return mockSuperUser;
    if (email === "normal-settings-test@platform.com") return mockAdminUser;
    return null;
  }),
  listPlatformUsers: vi.fn().mockResolvedValue([mockSuperUser, mockAdminUser]),
  insertPlatformUser: vi.fn().mockResolvedValue(undefined),
  deletePlatformUserRow: vi.fn().mockResolvedValue(undefined),
}));

let currentSettings: Record<string, unknown> = {
  id: "global",
  certbotEmail: "admin@madrasa.com",
  syncTlsOnCreate: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

vi.mock("../services/platform/platformSettingsService.js", () => ({
  getPlatformSettings: vi.fn().mockImplementation(() => currentSettings),
  updatePlatformSettings: vi.fn().mockImplementation(async (data: unknown) => {
    currentSettings = { ...currentSettings, ...(data as Record<string, unknown>) };
    return currentSettings;
  }),
}));

vi.mock("../services/platform/platformUserService.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/platform/platformUserService.js")>();
  return {
    ...actual,
    verifyPlatformUserPassword: vi
      .fn()
      .mockImplementation(async (_id: string, password: string) => {
        return password === "correct-password" || password === "TestPassword123!";
      }),
  };
});

vi.mock("../db/repositories/platformActivityLogsRepository.js", () => ({
  insertPlatformActivityLog: vi.fn().mockResolvedValue(undefined),
}));

describe("platformSettings REST API routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  function signPlatformToken(input: {
    id: string;
    email: string;
    name: string;
    role: "super_user" | "admin";
    sessionVersion: number;
  }): string {
    return app.jwt.sign({
      ...input,
      permissions:
        input.role === "super_user"
          ? { workspaces: true, onboard: true, settings: true, admins: true, system: true }
          : { workspaces: false, onboard: false, settings: false, admins: false, system: false },
      tokenType: "platform_access",
    });
  }

  it("rejects unauthenticated GET /api/platform/settings with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/settings",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns platform settings for super_user session", async () => {
    const token = signPlatformToken({
      id: "p-super",
      email: "admin@platform.com",
      name: "Super Admin",
      role: "super_user",
      sessionVersion: 0,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/platform/settings",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { settings: { id: string } };
    expect(body.settings).toBeDefined();
    expect(body.settings.id).toBe("global");
  });

  it("rejects non-super_user from reading platform settings with 403", async () => {
    const token = signPlatformToken({
      id: "p-admin",
      email: "normal-settings-test@platform.com",
      name: "Normal Admin",
      role: "admin",
      sessionVersion: 0,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/platform/settings",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
    });

    expect(res.statusCode).toBe(403);
  });

  it("allows platform super_user to update settings via PUT /api/platform/settings", async () => {
    const token = signPlatformToken({
      id: "p-super",
      email: "admin@platform.com",
      name: "Super Admin",
      role: "super_user",
      sessionVersion: 0,
    });

    const res = await app.inject({
      method: "PUT",
      url: "/api/platform/settings",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: {
        certbotEmail: "ssl@madrasa.com",
        syncTlsOnCreate: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { success: boolean; settings: { certbotEmail: string } };
    expect(body.success).toBe(true);
    expect(body.settings.certbotEmail).toBe("ssl@madrasa.com");
  });

  it("rejects non-super_user role from updating platform settings with 403", async () => {
    const token = signPlatformToken({
      id: "p-admin",
      email: "normal-settings-test@platform.com",
      name: "Normal Admin",
      role: "admin",
      sessionVersion: 0,
    });

    const res = await app.inject({
      method: "PUT",
      url: "/api/platform/settings",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: {
        certbotEmail: "hacker@example.com",
      },
    });

    expect(res.statusCode).toBe(403);
  });
});
