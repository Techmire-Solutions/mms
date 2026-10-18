import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import {
  getPlatformTelemetry,
  getPlatformActivityTrend,
} from "../services/platform/platformTelemetryService.js";

const { mockSuperUser, mockAdminUser } = vi.hoisted(() => {
  const mockSuperUser = {
    id: "p-super-telem",
    email: "telem-super@platform.com",
    name: "Telem Super",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
    role: "super_user" as const,
    permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: true },
    sessionVersion: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  const mockAdminUser = {
    id: "p-admin-no-sys",
    email: "telem-admin-nosys@platform.com",
    name: "Telem Admin NoSys",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
    role: "admin" as const,
    permissions: {
      workspaces: true,
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
  getPool: () => ({
    totalCount: 10,
    idleCount: 8,
    waitingCount: 0,
  }),
}));

vi.mock("../db/repositories/platformUserRepository.js", () => ({
  findPlatformUserRowById: vi.fn().mockImplementation(async (id: string) => {
    if (id === "p-super-telem") return mockSuperUser;
    if (id === "p-admin-no-sys") return mockAdminUser;
    return null;
  }),
  findPlatformUserRowByEmail: vi.fn().mockImplementation(async (email: string) => {
    if (email === "telem-super@platform.com") return mockSuperUser;
    if (email === "telem-admin-nosys@platform.com") return mockAdminUser;
    return null;
  }),
  listPlatformUsers: vi.fn().mockResolvedValue([mockSuperUser, mockAdminUser]),
}));

vi.mock("../db/repositories/platformActivityLogsRepository.js", () => ({
  getPlatformMonthlyActivityTrend: vi.fn().mockResolvedValue([
    { month: "Jan", yearMonth: "2026-01", tenants: 5, ops: 20 },
    { month: "Feb", yearMonth: "2026-02", tenants: 6, ops: 25 },
    { month: "Mar", yearMonth: "2026-03", tenants: 7, ops: 30 },
    { month: "Apr", yearMonth: "2026-04", tenants: 8, ops: 35 },
    { month: "May", yearMonth: "2026-05", tenants: 9, ops: 40 },
    { month: "Jun", yearMonth: "2026-06", tenants: 10, ops: 45 },
  ]),
  insertPlatformActivityLog: vi.fn().mockResolvedValue(undefined),
}));

describe("Platform Telemetry & Activity Trend API", () => {
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
    permissions?: Record<string, boolean>;
  }): string {
    return app.jwt.sign({
      ...input,
      permissions:
        input.permissions ??
        (input.role === "super_user"
          ? { workspaces: true, onboard: true, settings: true, admins: true, system: true }
          : { workspaces: true, onboard: false, settings: false, admins: false, system: false }),
      tokenType: "platform_access",
    });
  }

  describe("Service unit checks", () => {
    it("returns valid telemetry shape from getPlatformTelemetry()", async () => {
      const telemetry = await getPlatformTelemetry();
      expect(typeof telemetry).toBe("object");
      expect(telemetry.platformDb.engine).toContain("PostgreSQL");
      expect(telemetry.tenantDb.rlsIsolation).toBe("enforced");
      expect(typeof telemetry.dbPool.totalCount).toBe("number");
      expect(typeof telemetry.memory.rssMb).toBe("number");
      expect(typeof telemetry.latencyMs).toBe("number");
      expect(typeof telemetry.uptimeSeconds).toBe("number");
    });

    it("returns valid activity trend list from getPlatformActivityTrend()", async () => {
      const trend = await getPlatformActivityTrend(6);
      expect(Array.isArray(trend)).toBe(true);
      expect(trend.length).toBe(6);
      expect(trend[0]).toHaveProperty("month");
      expect(trend[0]).toHaveProperty("yearMonth");
      expect(trend[0]).toHaveProperty("tenants");
      expect(trend[0]).toHaveProperty("ops");
    });
  });

  describe("HTTP endpoint checks", () => {
    it("rejects unauthenticated requests to /telemetry with 401", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/platform/admin/system/telemetry",
      });
      expect(res.statusCode).toBe(401);
    });

    it("rejects users without system permission with 403", async () => {
      const token = signPlatformToken({
        id: "p-admin-no-sys",
        email: "telem-admin-nosys@platform.com",
        name: "Telem Admin NoSys",
        role: "admin",
        sessionVersion: 0,
        permissions: {
          workspaces: true,
          onboard: false,
          settings: false,
          admins: false,
          system: false,
        },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/platform/admin/system/telemetry",
        cookies: { mms_platform_access: token },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns telemetry data for authorized platform super user", async () => {
      const token = signPlatformToken({
        id: "p-super-telem",
        email: "telem-super@platform.com",
        name: "Telem Super",
        role: "super_user",
        sessionVersion: 0,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/platform/admin/system/telemetry",
        cookies: { mms_platform_access: token },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json).toHaveProperty("platformDb");
      expect(json).toHaveProperty("tenantDb");
      expect(json).toHaveProperty("dbPool");
      expect(json).toHaveProperty("memory");
      expect(json).toHaveProperty("latencyMs");
      expect(json).toHaveProperty("uptimeSeconds");
    });

    it("returns activity trend data for authorized platform super user", async () => {
      const token = signPlatformToken({
        id: "p-super-telem",
        email: "telem-super@platform.com",
        name: "Telem Super",
        role: "super_user",
        sessionVersion: 0,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/platform/admin/system/activity-trend",
        cookies: { mms_platform_access: token },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json).toHaveProperty("trend");
      expect(Array.isArray(json.trend)).toBe(true);
      expect(json.trend.length).toBe(6);
    });
  });
});
