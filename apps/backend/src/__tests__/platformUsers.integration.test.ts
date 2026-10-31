import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

const { mockUsers } = vi.hoisted(() => {
  const superUser = {
    id: "p-super",
    email: "admin@platform.com",
    name: "Super Admin",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
    role: "super_user" as const,
    permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: true },
    sessionVersion: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  const mockUsers: Array<{
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    role: "super_user" | "admin";
    permissions: Record<string, boolean>;
    sessionVersion: number;
    disabledAt?: string | null;
    createdAt: string;
  }> = [
    superUser,
    {
      id: "p-admin",
      email: "admin2@platform.com",
      name: "Regular Admin",
      passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
      role: "admin",
      permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: false },
      sessionVersion: 0,
      createdAt: "2026-01-02T00:00:00.000Z",
    },
  ];

  return { mockUsers };
});

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
  closeDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../db/repositories/platformUserRepository.js", () => ({
  findPlatformUserRowById: vi.fn().mockImplementation(async (id: string) => {
    return mockUsers.find((u) => u.id === id) ?? null;
  }),
  findPlatformUserRowByEmail: vi.fn().mockImplementation(async (email: string) => {
    return mockUsers.find((u) => u.email === email) ?? null;
  }),
  listPlatformUsers: vi.fn().mockImplementation(async () => [...mockUsers]),
  countPlatformUserRows: vi.fn().mockImplementation(async () => mockUsers.length),
  insertPlatformUser: vi.fn().mockImplementation(async (u: (typeof mockUsers)[number]) => {
    mockUsers.push(u);
    return u;
  }),
  deletePlatformUserRow: vi.fn().mockImplementation(async (id: string) => {
    const idx = mockUsers.findIndex((u) => u.id === id);
    if (idx >= 0) mockUsers.splice(idx, 1);
  }),
  updatePlatformUserRow: vi
    .fn()
    .mockImplementation(async (id: string, patch: Partial<(typeof mockUsers)[number]>) => {
      const user = mockUsers.find((u) => u.id === id);
      if (user) Object.assign(user, patch);
      return user ?? null;
    }),
}));

vi.mock("../services/platform/platformUserService.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/platform/platformUserService.js")>();
  return {
    ...actual,
    verifyPlatformUserPassword: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("../db/repositories/platformActivityLogsRepository.js", () => ({
  insertPlatformActivityLog: vi.fn().mockResolvedValue(undefined),
}));

describe("platformUsers REST API integration routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  function signPlatformToken(id = "p-super", sessionVersion = 0): string {
    return app.jwt.sign({
      id,
      tokenType: "platform_access",
      sessionVersion,
      permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: true },
    });
  }

  it("rejects unauthenticated GET /api/platform/users with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/users",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns platform users list for super_user session", async () => {
    const token = signPlatformToken("p-super", 0);
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/users",
      cookies: { mms_platform_access: token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.users)).toBe(true);
  });

  it("prevents self-disable on PATCH /api/platform/users/:id/disabled with 403", async () => {
    const token = signPlatformToken("p-super", 0);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/platform/users/p-super/disabled",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: {
        disabled: true,
        password: "Password123!",
      },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.message).toContain("Cannot disable your own platform account");
  });

  it("prevents self-delete on DELETE /api/platform/users/:id with 403", async () => {
    const token = signPlatformToken("p-super", 0);
    const res = await app.inject({
      method: "DELETE",
      url: "/api/platform/users/p-super",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: {
        password: "Password123!",
      },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.message).toContain("Cannot delete your own platform account");
  });

  it("refuses a delegated admins grant disabling a super-user", async () => {
    const token = signPlatformToken("p-admin", 0);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/platform/users/p-super/disabled",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: { disabled: true, password: "Password123!" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().message).toContain("Super-user privilege required");
  });

  it("refuses a delegated admins grant deleting a super-user", async () => {
    const token = signPlatformToken("p-admin", 0);
    const res = await app.inject({
      method: "DELETE",
      url: "/api/platform/users/p-super",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: { password: "Password123!" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().message).toContain("Super-user privilege required");
  });

  it("persists and updates all 5 granular permission keys for a platform admin", async () => {
    const token = signPlatformToken("p-super", 0);

    // 1. Create a platform admin with settings, admins, and system permissions enabled
    const email = `test-admin-${Date.now()}@platform.com`;
    const createRes = await app.inject({
      method: "POST",
      url: "/api/platform/users",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: {
        name: "Perm Test Admin",
        email,
        password: "Password123!",
        currentPassword: "OperatorPass123!",
        permissions: {
          workspaces: true,
          onboard: false,
          settings: true,
          admins: true,
          system: true,
        },
      },
    });
    expect(createRes.statusCode).toBe(200);
    const createdUser = createRes.json().user;
    expect(createdUser.permissions).toEqual({
      workspaces: true,
      onboard: false,
      settings: true,
      admins: true,
      system: true,
    });

    // 2. Fetch all users and verify permissions are loaded correctly from child table
    const listRes = await app.inject({
      method: "GET",
      url: "/api/platform/users",
      cookies: { mms_platform_access: token },
    });
    expect(listRes.statusCode).toBe(200);
    const foundUser = listRes.json().users.find((u: { id: string }) => u.id === createdUser.id);
    expect(foundUser).toBeDefined();
    expect(foundUser.permissions).toEqual({
      workspaces: true,
      onboard: false,
      settings: true,
      admins: true,
      system: true,
    });

    // 3. Update permissions and verify the changes persist
    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/platform/users/${createdUser.id}/permissions`,
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: {
        permissions: {
          workspaces: false,
          onboard: true,
          settings: false,
          admins: false,
          system: false,
        },
        password: "OperatorPass123!",
      },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().user.permissions).toEqual({
      workspaces: false,
      onboard: true,
      settings: false,
      admins: false,
      system: false,
    });
  });

  it("forbids a non-super-user admin from creating admins (403)", async () => {
    const token = signPlatformToken("p-admin", 0);
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/users",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: {
        name: "Escalation Attempt",
        email: "escalate@platform.com",
        password: "Password123!",
        currentPassword: "OperatorPass123!",
        permissions: {
          workspaces: true,
          onboard: true,
          settings: true,
          admins: true,
          system: true,
        },
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toContain("Super-user privilege required");
  });

  it("forbids a non-super-user admin from changing permissions (403)", async () => {
    const token = signPlatformToken("p-admin", 0);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/platform/users/p-super/permissions",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: {
        permissions: {
          workspaces: true,
          onboard: true,
          settings: true,
          admins: true,
          system: true,
        },
        password: "OperatorPass123!",
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toContain("Super-user privilege required");
  });

  it("forbids a super-user from changing their own permissions (403)", async () => {
    const token = signPlatformToken("p-super", 0);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/platform/users/p-super/permissions",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token },
      payload: {
        permissions: {
          workspaces: true,
          onboard: true,
          settings: true,
          admins: true,
          system: true,
        },
        password: "OperatorPass123!",
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toContain("Cannot change your own permissions");
  });
});
