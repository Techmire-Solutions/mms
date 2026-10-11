import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

const { mockSuperUser, mockWorkspaces } = vi.hoisted(() => {
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

  const mockWorkspaces = [
    {
      id: "ws-1",
      subdomain: "demo",
      name: "Demo Workspace",
      enabled: true,
      requireEmailVerification: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  return { mockSuperUser, mockWorkspaces };
});

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../db/repositories/platformUserRepository.js", () => ({
  findPlatformUserRowById: vi.fn().mockImplementation(async (id: string) => {
    if (id === "p-super") return mockSuperUser;
    return null;
  }),
  findPlatformUserRowByEmail: vi.fn().mockImplementation(async (email: string) => {
    if (email === "admin@platform.com") return mockSuperUser;
    return null;
  }),
  listPlatformUsers: vi.fn().mockResolvedValue([mockSuperUser]),
}));

vi.mock("../services/workspaceService.js", () => ({
  listPlatformWorkspaces: vi
    .fn()
    .mockImplementation(async (query: { page?: number; limit?: number } = {}) => {
      const page = query.page ?? 1;
      const pageSize = query.limit ?? 25;
      return {
        workspaces: mockWorkspaces,
        total: mockWorkspaces.length,
        page,
        pageSize,
      };
    }),
  getPlatformWorkspaceMetrics: vi.fn().mockResolvedValue({
    total: mockWorkspaces.length,
    active: mockWorkspaces.filter((w) => w.enabled).length,
    inactive: mockWorkspaces.filter((w) => !w.enabled).length,
  }),
  setWorkspaceEmailVerification: vi
    .fn()
    .mockImplementation(async (subdomain: string, requireEmailVerification: boolean) => {
      const ws = mockWorkspaces.find((w) => w.subdomain === subdomain);
      if (ws) ws.requireEmailVerification = requireEmailVerification;
      return ws ?? null;
    }),
  setWorkspaceEnabled: vi.fn().mockImplementation(async (subdomain: string, enabled: boolean) => {
    const ws = mockWorkspaces.find((w) => w.subdomain === subdomain);
    if (ws) ws.enabled = enabled;
    return ws ?? null;
  }),
  getPlatformWorkspaceSummary: vi.fn().mockImplementation(async (subdomain: string) => {
    const ws = mockWorkspaces.find((w) => w.subdomain === subdomain);
    return ws ?? null;
  }),
  getWorkspaceGrantedModules: vi.fn().mockResolvedValue([]),
  updateWorkspaceModules: vi.fn().mockResolvedValue([]),
  deleteWorkspace: vi.fn().mockResolvedValue(true),
}));

vi.mock("../db/repositories/platformActivityLogsRepository.js", () => ({
  insertPlatformActivityLog: vi.fn().mockResolvedValue(undefined),
}));

describe("platformWorkspaces REST API integration routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  function signPlatformToken(): string {
    return app.jwt.sign({
      id: "p-super",
      tokenType: "platform_access",
      sessionVersion: 0,
    });
  }

  it("rejects unauthenticated GET /api/platform/workspaces with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/workspaces",
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects unauthenticated PATCH /api/platform/workspaces/:subdomain/email-verification with 401", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/platform/workspaces/test-workspace/email-verification",
      payload: { requireEmailVerification: false },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns paginated workspaces for authenticated super-user session", async () => {
    const token = signPlatformToken();
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/workspaces",
      cookies: { mms_platform_access: token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.workspaces)).toBe(true);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(25);
  });

  it("returns workspace metrics for authenticated super-user session", async () => {
    const token = signPlatformToken();
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/workspaces/metrics",
      cookies: { mms_platform_access: token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.active).toBe(1);
    expect(body.inactive).toBe(0);
  });

  it("filters and pages workspaces via list query params", async () => {
    const token = signPlatformToken();
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/workspaces?page=1&limit=1&search=demo&status=active&sortField=name&sortDir=asc",
      cookies: { mms_platform_access: token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(1);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.workspaces).toHaveLength(1);
    expect(body.workspaces[0].subdomain).toBe("demo");
  });

  it("updates email verification for authenticated super-user session", async () => {
    const token = signPlatformToken();
    const res = await app.inject({
      method: "PATCH",
      url: "/api/platform/workspaces/demo/email-verification",
      headers: { origin: "http://localhost" },
      payload: { requireEmailVerification: false },
      cookies: { mms_platform_access: token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.requireEmailVerification).toBe(false);
  });

  it("toggles workspace enabled status for authenticated super-user session", async () => {
    const token = signPlatformToken();

    // Toggle off
    const resOff = await app.inject({
      method: "PATCH",
      url: "/api/platform/workspaces/demo",
      headers: { origin: "http://localhost" },
      payload: { enabled: false },
      cookies: { mms_platform_access: token },
    });
    expect(resOff.statusCode).toBe(200);
    const bodyOff = resOff.json();
    expect(bodyOff.workspace).toBeDefined();
    expect(bodyOff.workspace.enabled).toBe(false);

    // Revert back
    const resOn = await app.inject({
      method: "PATCH",
      url: "/api/platform/workspaces/demo",
      headers: { origin: "http://localhost" },
      payload: { enabled: true },
      cookies: { mms_platform_access: token },
    });
    expect(resOn.statusCode).toBe(200);
    const bodyOn = resOn.json();
    expect(bodyOn.workspace).toBeDefined();
    expect(bodyOn.workspace.enabled).toBe(true);
  });
});
