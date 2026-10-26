import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

const { admins } = vi.hoisted(() => {
  const base = {
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
    role: "admin" as const,
    sessionVersion: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  return {
    admins: {
      withWorkspaces: {
        ...base,
        id: "p-cons-ok",
        email: "cons-ok@platform.com",
        name: "Consolidation Admin",
        permissions: {
          workspaces: true,
          onboard: false,
          settings: false,
          admins: false,
          system: false,
        },
      },
      withoutWorkspaces: {
        ...base,
        id: "p-cons-no",
        email: "cons-no@platform.com",
        name: "Settings Admin",
        permissions: {
          workspaces: false,
          onboard: false,
          settings: true,
          admins: false,
          system: false,
        },
      },
    },
  };
});

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
  getPool: () => ({ totalCount: 1, idleCount: 1, waitingCount: 0 }),
}));

vi.mock("../db/repositories/platformUserRepository.js", () => ({
  findPlatformUserRowById: vi
    .fn()
    .mockImplementation(
      async (id: string) => Object.values(admins).find((a) => a.id === id) ?? null,
    ),
  findPlatformUserRowByEmail: vi
    .fn()
    .mockImplementation(
      async (email: string) => Object.values(admins).find((a) => a.email === email) ?? null,
    ),
  listPlatformUsers: vi.fn().mockResolvedValue(Object.values(admins)),
}));

const mockSave = vi.fn();
const mockReport = vi.fn();

vi.mock("../platform/use-cases/consolidationUseCases.js", () => ({
  listGroups: vi.fn().mockResolvedValue([]),
  saveGroup: (...args: unknown[]) => mockSave(...args),
  deleteGroup: vi.fn(),
  buildConsolidationReport: (...args: unknown[]) => mockReport(...args),
}));

const GROUP = {
  name: "Group",
  presentationCurrency: "PKR",
  intercompanyAccountCodes: ["1500"],
  members: [
    { memberSubdomain: "parent", ownershipPercent: 100, isParent: true },
    {
      memberSubdomain: "sub",
      ownershipPercent: 80,
      isParent: false,
      closingRate: "280",
      averageRate: "278",
      historicalRate: "270",
    },
  ],
};

describe("/api/platform/consolidation", () => {
  let app: FastifyInstance;
  const cookieFor = (admin: (typeof admins)[keyof typeof admins]) =>
    `mms_platform_access=${app.jwt.sign({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      sessionVersion: 0,
      permissions: admin.permissions,
      tokenType: "platform_access",
    })}`;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    mockSave.mockReset().mockResolvedValue({ id: "g1", ...GROUP });
    mockReport
      .mockReset()
      .mockResolvedValue({ group: { id: "g1" }, members: [], consolidated: {} });
  });

  it("given no platform session, should return 401", async () => {
    // Arrange / Act
    const res = await app.inject({ method: "GET", url: "/api/platform/consolidation/groups" });

    // Assert
    expect(res.statusCode).toBe(401);
  });

  it("given an admin without the workspaces grant, should return 403 and read no workspace books", async () => {
    // Arrange / Act
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/consolidation/groups/g1/report?dateFrom=2026-01-01&dateTo=2026-12-31",
      headers: { cookie: cookieFor(admins.withoutWorkspaces) },
    });

    // Assert
    expect(res.statusCode).toBe(403);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("given two parents, should reject the group", async () => {
    // Arrange
    const invalid = {
      ...GROUP,
      members: GROUP.members.map((member) => ({ ...member, isParent: true })),
    };

    // Act
    const res = await app.inject({
      method: "PUT",
      url: "/api/platform/consolidation/groups/g1",
      headers: { cookie: cookieFor(admins.withWorkspaces), origin: "http://localhost" },
      payload: invalid,
    });

    // Assert
    expect(res.statusCode).toBe(400);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("given a valid group and period, should save it and build the report", async () => {
    // Arrange
    const cookie = cookieFor(admins.withWorkspaces);

    // Act
    const saved = await app.inject({
      method: "PUT",
      url: "/api/platform/consolidation/groups/g1",
      headers: { cookie, origin: "http://localhost" },
      payload: GROUP,
    });
    const report = await app.inject({
      method: "GET",
      url: "/api/platform/consolidation/groups/g1/report?dateFrom=2026-01-01&dateTo=2026-12-31",
      headers: { cookie },
    });

    // Assert
    expect(saved.statusCode).toBe(200);
    expect(report.statusCode).toBe(200);
    expect(mockReport).toHaveBeenCalledWith(expect.anything(), "g1", {
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });
  });
});
