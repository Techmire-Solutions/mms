import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { MIGRATE_AND_RESTART_CONFIRM } from "@mms/shared";

const scheduleMigrateAndRestart = vi.fn().mockReturnValue(true);
const isRemoteMigrateRestartEnabled = vi.fn().mockReturnValue(true);
const isMigrateRestartInFlight = vi.fn().mockReturnValue(false);

const { mockSuperUser, mockAdminUser } = vi.hoisted(() => {
  const mockSuperUser = {
    id: "p-super-migrate",
    email: "migrate-super@platform.com",
    name: "Migrate Super",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
    role: "super_user" as const,
    permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: true },
    sessionVersion: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  const mockAdminUser = {
    id: "p-admin-migrate",
    email: "migrate-admin@platform.com",
    name: "Migrate Admin",
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
    if (id === "p-super-migrate") return mockSuperUser;
    if (id === "p-admin-migrate") return mockAdminUser;
    return null;
  }),
  findPlatformUserRowByEmail: vi.fn().mockImplementation(async (email: string) => {
    if (email === "migrate-super@platform.com") return mockSuperUser;
    if (email === "migrate-admin@platform.com") return mockAdminUser;
    return null;
  }),
  listPlatformUsers: vi.fn().mockResolvedValue([mockSuperUser, mockAdminUser]),
  updatePlatformUserRow: vi.fn().mockResolvedValue(mockSuperUser),
}));

vi.mock("../services/platform/platformUserService.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/platform/platformUserService.js")>();
  return {
    ...actual,
    verifyPlatformUserPassword: vi
      .fn()
      .mockImplementation(async (_id: string, password: string) => {
        return password === "TestPassword123!";
      }),
  };
});

vi.mock("../db/repositories/platformActivityLogsRepository.js", () => ({
  insertPlatformActivityLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/platform/platformAdminService.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/platform/platformAdminService.js")>();
  return {
    ...actual,
    scheduleMigrateAndRestart: (...args: unknown[]) => scheduleMigrateAndRestart(...args),
    isRemoteMigrateRestartEnabled: () => isRemoteMigrateRestartEnabled(),
    isMigrateRestartInFlight: () => isMigrateRestartInFlight(),
  };
});

describe("platform admin system migrate-and-restart", () => {
  let app: FastifyInstance;
  const superPassword = "TestPassword123!";

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    scheduleMigrateAndRestart.mockReset().mockReturnValue(true);
    isRemoteMigrateRestartEnabled.mockReset().mockReturnValue(true);
    isMigrateRestartInFlight.mockReset().mockReturnValue(false);
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

  it("rejects unauthenticated requests with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/admin/system/migrate-and-restart",
      payload: { confirm: MIGRATE_AND_RESTART_CONFIRM, password: "x" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects non-super_user with 403", async () => {
    const token = signPlatformToken({
      id: "p-admin-migrate",
      email: "migrate-admin@platform.com",
      name: "Migrate Admin",
      role: "admin",
      sessionVersion: 0,
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/admin/system/migrate-and-restart",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: { confirm: MIGRATE_AND_RESTART_CONFIRM, password: superPassword },
    });
    expect(res.statusCode).toBe(403);
    expect(scheduleMigrateAndRestart).not.toHaveBeenCalled();
  });

  it("rejects tenant subdomain host with 403", async () => {
    const token = signPlatformToken({
      id: "p-super-migrate",
      email: "migrate-super@platform.com",
      name: "Migrate Super",
      role: "super_user",
      sessionVersion: 0,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/platform/admin/system/migrate-and-restart",
      headers: { origin: "http://localhost", host: "demo.localhost" },
      cookies: { mms_platform_access: token },
      payload: { confirm: MIGRATE_AND_RESTART_CONFIRM, password: superPassword },
    });
    expect(res.statusCode).toBe(403);
    expect(scheduleMigrateAndRestart).not.toHaveBeenCalled();
  });

  it("rejects when remote migrate-restart is disabled", async () => {
    isRemoteMigrateRestartEnabled.mockReturnValue(false);
    const token = signPlatformToken({
      id: "p-super-migrate",
      email: "migrate-super@platform.com",
      name: "Migrate Super",
      role: "super_user",
      sessionVersion: 0,
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/admin/system/migrate-and-restart",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: { confirm: MIGRATE_AND_RESTART_CONFIRM, password: superPassword },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "remote_migrate_disabled" });
    expect(scheduleMigrateAndRestart).not.toHaveBeenCalled();
  });

  it("validates confirmation and password", async () => {
    const token = signPlatformToken({
      id: "p-super-migrate",
      email: "migrate-super@platform.com",
      name: "Migrate Super",
      role: "super_user",
      sessionVersion: 0,
    });

    const badConfirm = await app.inject({
      method: "POST",
      url: "/api/platform/admin/system/migrate-and-restart",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: { confirm: "WRONG", password: superPassword },
    });
    expect(badConfirm.statusCode).toBe(400);

    const wrongPw = await app.inject({
      method: "POST",
      url: "/api/platform/admin/system/migrate-and-restart",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: { confirm: MIGRATE_AND_RESTART_CONFIRM, password: "wrong-password" },
    });
    expect(wrongPw.statusCode).toBe(401);
    expect(scheduleMigrateAndRestart).not.toHaveBeenCalled();
  });

  it("accepts migrate-and-restart for super_user and schedules work", async () => {
    const token = signPlatformToken({
      id: "p-super-migrate",
      email: "migrate-super@platform.com",
      name: "Migrate Super",
      role: "super_user",
      sessionVersion: 0,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/platform/admin/system/migrate-and-restart",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: { confirm: MIGRATE_AND_RESTART_CONFIRM, password: superPassword },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { accepted?: boolean; success?: boolean; delayMs?: number };
    expect(body.accepted).toBe(true);
    expect(body.success).toBe(true);
    expect(typeof body.delayMs).toBe("number");
    expect(scheduleMigrateAndRestart).toHaveBeenCalledTimes(1);
    expect(scheduleMigrateAndRestart.mock.calls[0]?.[0]).toMatchObject({
      userId: "p-super-migrate",
    });
  });

  it("returns 409 when a migrate-and-restart is already in flight", async () => {
    scheduleMigrateAndRestart.mockReturnValue(false);

    const token = signPlatformToken({
      id: "p-super-migrate",
      email: "migrate-super@platform.com",
      name: "Migrate Super",
      role: "super_user",
      sessionVersion: 0,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/platform/admin/system/migrate-and-restart",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: { confirm: MIGRATE_AND_RESTART_CONFIRM, password: superPassword },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ type: "migrate_restart_in_progress" });
    expect(scheduleMigrateAndRestart).toHaveBeenCalledTimes(1);
  });
});
