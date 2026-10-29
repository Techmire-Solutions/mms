import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import type { WorkspaceUser, ActivityLog } from "@mms/shared";
import { adminToken, teacherToken, signTenantToken } from "./helpers/tokens.js";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: vi
    .fn()
    .mockImplementation(async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
      callback({} as any),
    ),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
}));

vi.mock("../services/workspaceService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/workspaceService.js")>();
  const demoWorkspace = {
    id: "ws-demo",
    subdomain: "demo",
    madrasaName: "Demo Madrasa",
    createdAt: "2026-01-01T00:00:00.000Z",
    enabled: true,
  };
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo" ? demoWorkspace : null,
      ),
  };
});

const mockLoadWorkspaceUsers = vi.fn();
const mockUpsertWorkspaceUsers = vi.fn();
const mockLoadLogs = vi.fn();
const mockUpsertLogs = vi.fn();
const mockDeleteUserById = vi.fn();
const mockRestoreUserById = vi.fn();
const mockBulkSoftDeleteUsers = vi.fn();
const mockBulkRestoreUsers = vi.fn();
const mockResetUserPasswordById = vi.fn();

vi.mock("../users/use-cases/usersUseCases.js", () => ({
  usersUseCases: {
    loadUsersPage: vi.fn().mockImplementation(async (query: { includeDeleted?: boolean }) => {
      const users = await mockLoadWorkspaceUsers(query);
      return { users, total: users.length, page: 1, limit: 50, hasMore: false };
    }),
    loadWorkspaceUsers: (...args: unknown[]) => mockLoadWorkspaceUsers(...args),
    upsertWorkspaceUsers: (...args: unknown[]) => mockUpsertWorkspaceUsers(...args),
    loadLogs: (...args: unknown[]) => mockLoadLogs(...args),
    upsertLogs: (...args: unknown[]) => mockUpsertLogs(...args),
    deleteUserById: (...args: unknown[]) => mockDeleteUserById(...args),
    restoreUserById: (...args: unknown[]) => mockRestoreUserById(...args),
    bulkSoftDeleteUsers: (...args: unknown[]) => mockBulkSoftDeleteUsers(...args),
    bulkRestoreUsers: (...args: unknown[]) => mockBulkRestoreUsers(...args),
    resetUserPasswordById: (...args: unknown[]) => mockResetUserPasswordById(...args),
    countUsers: vi.fn().mockResolvedValue(0),
    loadUsersCommandMetrics: vi.fn().mockResolvedValue({}),
    loadUsersByIds: vi.fn().mockResolvedValue([]),
    createWorkspaceUser: vi.fn(),
    updateWorkspaceUser: vi.fn(),
    inviteWorkspaceUser: vi.fn(),
    verifyUserEmailById: vi.fn(),
  },
}));

const mockGetUserColumnPreferencesForModule = vi.fn();
const mockSetUserColumnPreferencesForModule = vi.fn();

vi.mock("../services/userColumnPreferencesService.js", () => ({
  getUserColumnPreferencesForModule: (...args: unknown[]) =>
    mockGetUserColumnPreferencesForModule(...args),
  setUserColumnPreferencesForModule: (...args: unknown[]) =>
    mockSetUserColumnPreferencesForModule(...args),
}));

const sampleUser: WorkspaceUser = {
  id: "u-1",
  contactId: "c-1",
  name: "Ahmed User",
  email: "ahmed@test.com",
  loginEmail: "ahmed@test.com",
  phone: "3001234567",
  role: "teacher",
  status: "active",
  twoFactorEnabled: false,
  lastLogin: "2026-06-26T12:00:00.000Z",
  createdDate: "2026-06-26",
  failedLoginAttempts: 0,
  activeSessions: 1,
  avatarInitials: "AU",
};

const sampleLog: ActivityLog = {
  id: "log-1",
  userId: "u-1",
  userName: "Ahmed User",
  action: "login",
  module: "auth",
  detail: "User logged in",
  ts: "2026-06-26T12:00:00.000Z",
  ip: "127.0.0.1",
};

describe("users REST routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadWorkspaceUsers.mockReset().mockResolvedValue([sampleUser]);
    mockUpsertWorkspaceUsers.mockReset().mockResolvedValue([sampleUser]);
    mockLoadLogs.mockReset().mockResolvedValue([sampleLog]);
    mockUpsertLogs.mockReset().mockResolvedValue([sampleLog]);
    mockDeleteUserById.mockReset().mockResolvedValue(true);
    mockRestoreUserById.mockReset().mockResolvedValue(true);
    mockBulkSoftDeleteUsers.mockReset().mockResolvedValue({ succeeded: 1, failed: 0 });
    mockBulkRestoreUsers.mockReset().mockResolvedValue({ succeeded: 1, failed: 0 });
    mockResetUserPasswordById.mockReset().mockResolvedValue(true);
    mockGetUserColumnPreferencesForModule.mockReset().mockResolvedValue([]);
    mockSetUserColumnPreferencesForModule.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/users requires auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/users",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/users returns 403 for unauthorized roles", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/users",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("GET /api/users loads users for admin", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/users",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      users: [sampleUser],
      total: 1,
      page: 1,
      limit: 50,
      hasMore: false,
    });
    expect(mockLoadWorkspaceUsers).toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/users forwards bounded id lookup", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/users?page=1&limit=2&ids=u-1%2Cu-2",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockLoadWorkspaceUsers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 2, ids: "u-1,u-2" }),
    );
    await app.close();
  });

  it("GET /api/users?includeDeleted=true loads trash for admin", async () => {
    const deletedUser = {
      ...sampleUser,
      deletedAt: "2026-07-01T00:00:00.000Z",
      deletedBy: "u-admin",
    };
    mockLoadWorkspaceUsers.mockResolvedValueOnce([deletedUser]);
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/users?includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      users: [deletedUser],
      total: 1,
      page: 1,
      limit: 50,
      hasMore: false,
    });
    expect(mockLoadWorkspaceUsers).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
    await app.close();
  });

  it("GET /api/users?includeDeleted=true returns 403 when user lacks delete permission", async () => {
    const rbacService = await import("../services/rbacService.js");
    const spy = vi.spyOn(rbacService, "canDeleteCollection").mockReturnValue(false);
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/users?includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ type: "forbidden", message: "Insufficient permissions" });
    spy.mockRestore();
    await app.close();
  });

  it("PUT /api/users/bulk updates users", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/users/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([sampleUser]),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ users: [sampleUser] });
    expect(mockUpsertWorkspaceUsers).toHaveBeenCalledWith([sampleUser], "admin");
    await app.close();
  });

  it("DELETE /api/users/:id soft-deletes a user", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/users/u-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    expect(mockDeleteUserById).toHaveBeenCalledWith("u-1", "u-admin", "admin");
    await app.close();
  });

  it("POST /api/users/:id/restore restores a user", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users/u-1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    expect(mockRestoreUserById).toHaveBeenCalledWith("u-1", "admin", "u-admin", "127.0.0.1");
    await app.close();
  });

  it("POST /api/users/:id/restore returns 409 conflict when code is 23505", async () => {
    const error = new Error("duplicate key value violates unique constraint");
    Object.assign(error, { code: "23505" });
    mockRestoreUserById.mockRejectedValue(error);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users/u-1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual(expect.objectContaining({ type: "conflict" }));
    await app.close();
  });

  it("POST /api/users/:id/reset-password issues a temporary password for an admin", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users/u-1/reset-password",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ temporaryPassword: "TemporaryPass1!" }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    expect(mockResetUserPasswordById).toHaveBeenCalledWith(
      "u-1",
      "TemporaryPass1!",
      "admin",
      "u-admin",
      "127.0.0.1",
      expect.any(Function),
    );
    await app.close();
  });

  it("POST /api/users/:id/reset-password returns a traceable server failure", async () => {
    const resetError = Object.assign(new Error("database write failed"), {
      type: "password_reset_failed",
      passwordResetStage: "credential_update",
    });
    mockResetUserPasswordById.mockRejectedValueOnce(resetError);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users/u-1/reset-password",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ temporaryPassword: "TemporaryPass1!" }),
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({
      type: "password_reset_failed",
      stage: "credential_update",
      dependency: "database",
    });
    expect(res.json().message).toContain("Reference:");
    await app.close();
  });

  it("POST /api/users/:id/reset-password denies users without manage permission", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users/u-1/reset-password",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ temporaryPassword: "TemporaryPass1!" }),
    });
    expect(res.statusCode).toBe(403);
    expect(mockResetUserPasswordById).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/users/:id/reset-password rejects an administrator resetting self", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users/u-admin/reset-password",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ temporaryPassword: "TemporaryPass1!" }),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ type: "self_password_reset" });
    expect(mockResetUserPasswordById).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/users/:id/reset-password validates the request body", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users/u-1/reset-password",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(res.statusCode).toBe(400);
    expect(mockResetUserPasswordById).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/users/bulk-restore restores multiple users", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users/bulk-restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ids: ["u-1"] }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, succeeded: 1, failed: 0 });
    expect(mockBulkRestoreUsers).toHaveBeenCalledWith(["u-1"], "admin", "u-admin", "127.0.0.1");
    await app.close();
  });

  it("GET /api/users/activity loads logs", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/users/activity",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ logs: [sampleLog] });
    expect(mockLoadLogs).toHaveBeenCalled();
    await app.close();
  });

  it("PUT /api/users/activity/bulk upserts logs without wipe semantics", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/users/activity/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([sampleLog]),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ logs: [sampleLog] });
    expect(mockUpsertLogs).toHaveBeenCalledWith([
      expect.objectContaining({
        id: sampleLog.id,
        userId: "u-admin",
        userName: "Admin",
        ip: "127.0.0.1",
      }),
    ]);
    await app.close();
  });

  it("PUT /api/users/activity/bulk returns 403 for unauthorized roles", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/users/activity/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "viewer" })}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([sampleLog]),
    });
    expect(res.statusCode).toBe(403);
    expect(mockUpsertLogs).not.toHaveBeenCalled();
    await app.close();
  });
});
