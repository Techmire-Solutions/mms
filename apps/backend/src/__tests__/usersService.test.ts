import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";
import { verifyPassword } from "../services/auth/passwordService.js";
import {
  findTenantUserRowById,
  verifyTenantUserEmailRow,
  resetTenantUserPasswordRow,
} from "../db/repositories/tenantUserRepository.js";
import {
  upsertLogs,
  verifyUserEmailById,
  resetUserPasswordById,
  deleteUserById,
  upsertWorkspaceUsers,
} from "../services/usersService.js";
import { broadcastCollection } from "../lib/livePush.js";
import { assertPasswordMeetsPolicy } from "../services/globalSettingsService.js";
import { deleteRefreshTokensForUser } from "../services/auth/authArtifactService.js";
import { revokeAllUserSessions } from "../services/authSessionService.js";

const { bulkSaveActivityLogs, replaceActivityLogsForWorkspace } = vi.hoisted(() => ({
  bulkSaveActivityLogs: vi.fn(),
  replaceActivityLogsForWorkspace: vi.fn(),
}));

vi.mock("../db/repositories/logsRepository.js", () => ({
  listActivityLogsByWorkspace: vi.fn().mockResolvedValue([]),
  findActivityLogById: vi.fn().mockResolvedValue(null),
  findActivityLogsByIds: vi.fn().mockResolvedValue([]),
  saveActivityLog: vi.fn().mockResolvedValue(undefined),
  bulkSaveActivityLogs,
  replaceActivityLogsForWorkspace,
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn(),
  broadcastTenantUpdate: vi.fn(),
}));

vi.mock("../services/auth/userService.js", () => ({
  getHydratedUsers: vi.fn().mockResolvedValue([]),
  saveUsers: vi.fn(),
}));

vi.mock("../db/repositories/tenantUserRepository.js", () => ({
  softDeleteTenantUserRow: vi.fn(),
  restoreTenantUserRow: vi.fn(),
  verifyTenantUserEmailRow: vi.fn().mockResolvedValue(true),
  findTenantUserRowById: vi.fn(),
  resetTenantUserPasswordRow: vi.fn(),
  listTenantUsersByIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  deleteRefreshTokensForUser: vi.fn(),
}));

vi.mock("../services/globalSettingsService.js", () => ({
  assertPasswordMeetsPolicy: vi.fn(),
}));

vi.mock("../services/authSessionService.js", () => ({
  revokeAllUserSessions: vi.fn(),
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: vi
    .fn()
    .mockImplementation(async (_tenant: string, callback: () => Promise<unknown>) => callback()),
}));

/**
 * Installs a tenant-aware stand-in for `findTenantUserRowById`.
 *
 * The real repository scopes the lookup to the caller's workspace in SQL (see
 * tenantUserRepositoryHydrate.ts), so a row is only visible inside its own
 * workspace. Tests must mirror that, otherwise a cross-tenant case would
 * spuriously "pass" against a repository that returns anything.
 */
async function mockUserRowForTenant(row: Record<string, unknown>): Promise<void> {
  vi.mocked(findTenantUserRowById).mockImplementation(async (tenant: string, id: string) =>
    String(row.id) === id && row.workspaceSubdomain === tenant ? (row as never) : null,
  );
}

describe("usersService activity log upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bulk saves supplied logs without replacing the workspace collection", async () => {
    const log = {
      id: "log-1",
      userId: "u-1",
      userName: "Ahmed User",
      action: "login" as const,
      module: "auth",
      detail: "User logged in",
      ts: "2026-06-26T12:00:00.000Z",
      ip: "127.0.0.1",
    };

    const result = await runWithTenant("demo", () => upsertLogs([log]));

    expect(result).toEqual([log]);
    expect(bulkSaveActivityLogs).toHaveBeenCalledWith("demo", [log]);
    expect(replaceActivityLogsForWorkspace).not.toHaveBeenCalled();
  });

  it("verifies user email and broadcasts collection update", async () => {
    await mockUserRowForTenant({
      id: "u-123",
      workspaceSubdomain: "demo",
      passwordHash: "hash",
      loginEmail: "user@demo.local",
      name: "Demo User",
      role: "teacher",
      deletedAt: null,
    });

    const result = await runWithTenant("demo", () => verifyUserEmailById("u-123"));

    expect(result).toBe(true);
    expect(verifyTenantUserEmailRow).toHaveBeenCalledWith("demo", "u-123");
    expect(broadcastCollection).toHaveBeenCalledWith("users");
  });

  it("resets a user password, forces a change, and revokes every session", async () => {
    await mockUserRowForTenant({
      id: "u-123",
      workspaceSubdomain: "demo",
      passwordHash: "old-hash",
      loginEmail: "user@demo.local",
      name: "Demo User",
      role: "teacher",
      deletedAt: null,
    });
    vi.mocked(resetTenantUserPasswordRow).mockResolvedValue(true);

    const result = await runWithTenant("demo", () =>
      resetUserPasswordById("u-123", "TemporaryPass1!"),
    );

    expect(result).toBe(true);
    expect(assertPasswordMeetsPolicy).toHaveBeenCalledWith("TemporaryPass1!");
    const passwordHash = vi.mocked(resetTenantUserPasswordRow).mock.calls[0]?.[2];
    expect(typeof passwordHash).toBe("string");
    expect(passwordHash).not.toBe("old-hash");
    expect(passwordHash!.length).toBeGreaterThan(20);
    await expect(verifyPassword("TemporaryPass1!", passwordHash!)).resolves.toBe(true);
    expect(deleteRefreshTokensForUser).toHaveBeenCalledWith("u-123");
    expect(revokeAllUserSessions).toHaveBeenCalledWith("u-123");
    expect(broadcastCollection).toHaveBeenCalledWith("users");
  });

  it("does not report a completed password reset as failed when activity logging fails", async () => {
    const auxiliaryError = new Error("activity log unavailable");
    const onAuxiliaryError = vi.fn();

    await mockUserRowForTenant({
      id: "u-123",
      workspaceSubdomain: "demo",
      passwordHash: "old-hash",
      loginEmail: "user@demo.local",
      name: "Demo User",
      role: "teacher",
      deletedAt: null,
    });
    vi.mocked(resetTenantUserPasswordRow).mockResolvedValue(true);
    bulkSaveActivityLogs.mockRejectedValueOnce(auxiliaryError);

    const result = await runWithTenant("demo", () =>
      resetUserPasswordById(
        "u-123",
        "TemporaryPass1!",
        "admin",
        "u-admin",
        "127.0.0.1",
        onAuxiliaryError,
      ),
    );

    expect(result).toBe(true);
    expect(onAuxiliaryError).toHaveBeenCalledWith("activity_log", auxiliaryError);
  });

  it("labels refresh-token revocation failures separately from credential updates", async () => {
    await mockUserRowForTenant({
      id: "u-123",
      workspaceSubdomain: "demo",
      passwordHash: "old-hash",
      loginEmail: "user@demo.local",
      name: "Demo User",
      role: "teacher",
      deletedAt: null,
    });
    vi.mocked(resetTenantUserPasswordRow).mockResolvedValue(true);
    vi.mocked(deleteRefreshTokensForUser).mockRejectedValueOnce(
      new Error("auth artifact delete failed"),
    );

    await expect(
      runWithTenant("demo", () =>
        resetUserPasswordById("u-123", "TemporaryPass1!", "admin", "u-admin"),
      ),
    ).rejects.toMatchObject({
      type: "password_reset_failed",
      passwordResetStage: "refresh_token_revocation",
    });
  });

  it("labels credential update failures for server diagnostics", async () => {
    await mockUserRowForTenant({
      id: "u-123",
      workspaceSubdomain: "demo",
      passwordHash: "old-hash",
      loginEmail: "user@demo.local",
      name: "Demo User",
      role: "teacher",
      deletedAt: null,
    });
    vi.mocked(resetTenantUserPasswordRow).mockRejectedValueOnce(
      new Error("credential update failed"),
    );

    await expect(
      runWithTenant("demo", () =>
        resetUserPasswordById("u-123", "TemporaryPass1!", "admin", "u-admin"),
      ),
    ).rejects.toMatchObject({
      type: "password_reset_failed",
      passwordResetStage: "credential_update",
    });
  });

  it("labels Redis session revocation failures for server diagnostics", async () => {
    await mockUserRowForTenant({
      id: "u-123",
      workspaceSubdomain: "demo",
      passwordHash: "old-hash",
      loginEmail: "user@demo.local",
      name: "Demo User",
      role: "teacher",
      deletedAt: null,
    });
    vi.mocked(resetTenantUserPasswordRow).mockResolvedValue(true);
    vi.mocked(revokeAllUserSessions).mockRejectedValueOnce(new Error("session store unavailable"));

    await expect(
      runWithTenant("demo", () =>
        resetUserPasswordById("u-123", "TemporaryPass1!", "admin", "u-admin"),
      ),
    ).rejects.toMatchObject({
      type: "password_reset_failed",
      passwordResetStage: "session_revocation",
    });
  });

  it("does not reset a user belonging to another tenant", async () => {
    await mockUserRowForTenant({
      id: "u-other",
      workspaceSubdomain: "other",
      passwordHash: "old-hash",
      loginEmail: "user@other.local",
      name: "Other User",
      role: "teacher",
      deletedAt: null,
    });

    const result = await runWithTenant("demo", () =>
      resetUserPasswordById("u-other", "TemporaryPass1!", "admin", "u-admin"),
    );

    expect(result).toBe(false);
    expect(resetTenantUserPasswordRow).not.toHaveBeenCalled();
  });

  it("rejects password reset of a super_admin user by a regular admin", async () => {
    await mockUserRowForTenant({
      id: "u-super",
      workspaceSubdomain: "demo",
      passwordHash: "old-hash",
      loginEmail: "super@demo.local",
      name: "Super Admin",
      role: "super_admin",
      deletedAt: null,
    });

    await expect(
      runWithTenant("demo", () => resetUserPasswordById("u-super", "TemporaryPass1!", "admin")),
    ).rejects.toThrow("Cannot reset password of a Super Admin user account");
  });

  it("allows password reset of a super_admin user by another super_admin", async () => {
    await mockUserRowForTenant({
      id: "u-super",
      workspaceSubdomain: "demo",
      passwordHash: "old-hash",
      loginEmail: "super@demo.local",
      name: "Super Admin",
      role: "super_admin",
      deletedAt: null,
    });
    vi.mocked(resetTenantUserPasswordRow).mockResolvedValue(true);

    const result = await runWithTenant("demo", () =>
      resetUserPasswordById("u-super", "TemporaryPass1!", "super_admin"),
    );
    expect(result).toBe(true);
  });

  it("rejects deleting a super_admin user by a regular admin", async () => {
    await mockUserRowForTenant({
      id: "u-super",
      workspaceSubdomain: "demo",
      passwordHash: "old-hash",
      loginEmail: "super@demo.local",
      name: "Super Admin",
      role: "super_admin",
      deletedAt: null,
    });

    await expect(
      runWithTenant("demo", () => deleteUserById("u-super", "u-admin", "admin")),
    ).rejects.toThrow("Cannot delete a Super Admin user account");
  });

  it("rejects assigning super_admin role by a regular admin in upsertWorkspaceUsers", async () => {
    const superAdminUser = {
      id: "u-new",
      contactId: "c-1",
      name: "New Super",
      email: "new@demo.local",
      loginEmail: "new@demo.local",
      phone: "3001234567",
      role: "super_admin",
      status: "active" as const,
      twoFactorEnabled: false,
      lastLogin: "2026-06-26T12:00:00.000Z",
      createdDate: "2026-06-26",
      failedLoginAttempts: 0,
      activeSessions: 1,
      avatarInitials: "NS",
    };

    await expect(upsertWorkspaceUsers([superAdminUser], "admin")).rejects.toThrow(
      "Only Super Admin can assign the Super Admin role",
    );
  });
});
