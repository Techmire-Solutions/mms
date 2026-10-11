import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

const { mockPlatformAdmin } = vi.hoisted(() => {
  const mockPlatformAdmin = {
    id: "p-admin-erd-test",
    email: "admin-erd@platform.com",
    name: "ERD Admin",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
    role: "admin" as const,
    permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: true },
    sessionVersion: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  return { mockPlatformAdmin };
});

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
  getPool: () => ({ totalCount: 1, idleCount: 1, waitingCount: 0 }),
}));

vi.mock("../db/repositories/platformUserRepository.js", () => ({
  findPlatformUserRowById: vi.fn().mockImplementation(async (id: string) => {
    if (id === "p-admin-erd-test") return mockPlatformAdmin;
    return null;
  }),
  findPlatformUserRowByEmail: vi.fn().mockImplementation(async (email: string) => {
    if (email === "admin-erd@platform.com") return mockPlatformAdmin;
    return null;
  }),
  listPlatformUsers: vi.fn().mockResolvedValue([mockPlatformAdmin]),
}));

describe("GET /api/platform/schema/erd", () => {
  let app: FastifyInstance;
  let adminCookie: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
    await app.ready();

    const token = app.jwt.sign({
      id: mockPlatformAdmin.id,
      email: mockPlatformAdmin.email,
      name: mockPlatformAdmin.name,
      role: mockPlatformAdmin.role,
      sessionVersion: 0,
      permissions: mockPlatformAdmin.permissions,
      tokenType: "platform_access",
    });
    adminCookie = `mms_platform_access=${token}`;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/schema/erd",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns dynamic ERD domains with 200 for authenticated platform operator", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/schema/erd",
      headers: {
        cookie: adminCookie,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.domains)).toBe(true);
    expect(json.totalTables).toBeGreaterThan(50);

    const contactsDomain = json.domains.find((d: { id: string }) => d.id === "contacts");
    expect(contactsDomain).toBeDefined();
    expect(contactsDomain.tables.length).toBeGreaterThanOrEqual(14);
  });

  it("rejects authenticated admins lacking the system permission with 403", async () => {
    const limitedAdmin = {
      ...mockPlatformAdmin,
      id: "p-admin-erd-limited",
      email: "limited-erd@platform.com",
      permissions: {
        workspaces: true,
        onboard: false,
        settings: false,
        admins: false,
        system: false,
      },
    };
    const { findPlatformUserRowById } =
      await import("../db/repositories/platformUserRepository.js");
    vi.mocked(findPlatformUserRowById).mockImplementation(async (id: string) => {
      if (id === limitedAdmin.id) return limitedAdmin;
      if (id === mockPlatformAdmin.id) return mockPlatformAdmin;
      return null;
    });

    const token = app.jwt.sign({
      id: limitedAdmin.id,
      email: limitedAdmin.email,
      name: limitedAdmin.name,
      role: limitedAdmin.role,
      sessionVersion: 0,
      permissions: limitedAdmin.permissions,
      tokenType: "platform_access",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/platform/schema/erd",
      headers: { cookie: `mms_platform_access=${token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
