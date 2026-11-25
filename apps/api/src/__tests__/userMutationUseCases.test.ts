import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";
import {
  upsertWorkspaceUsersHelper,
  updateWorkspaceUserHelper,
  deleteUserByIdHelper,
} from "../users/use-cases/userMutationUseCases.js";

const mocks = vi.hoisted(() => ({
  getHydratedUsers: vi.fn(),
  saveUsers: vi.fn(),
  getRawUsers: vi.fn(),
  invalidateTenantRbac: vi.fn(),
  broadcastCollection: vi.fn(),
  isFacultyDesignationRoleLocked: vi.fn(),
}));

vi.mock("../services/auth/userService.js", () => ({
  getHydratedUsers: mocks.getHydratedUsers,
  saveUsers: mocks.saveUsers,
}));

vi.mock("../services/auth/userServiceShared.js", () => ({
  getRawUsers: mocks.getRawUsers,
}));

vi.mock("../services/rbacService.js", () => ({
  invalidateTenantRbac: mocks.invalidateTenantRbac,
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: mocks.broadcastCollection,
}));

vi.mock("../faculty/use-cases/facultyUserRoleGuards.js", () => ({
  isFacultyDesignationRoleLocked: mocks.isFacultyDesignationRoleLocked,
}));

vi.mock("../users/use-cases/userActivityLogUseCases.js", () => ({
  recordUserActivityLog: vi.fn().mockResolvedValue(undefined),
}));

describe("userMutationUseCases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("upsertWorkspaceUsersHelper", () => {
    it("strips credential and lifecycle fields before saving bulk records", async () => {
      mocks.getHydratedUsers.mockResolvedValue([]);
      mocks.saveUsers.mockResolvedValue(undefined);

      await runWithTenant("demo", () =>
        upsertWorkspaceUsersHelper(
          [
            {
              id: "u-1",
              name: "Target",
              email: "target@demo.local",
              role: "teacher",
              status: "active",
              twoFactorEnabled: false,
              temporaryPassword: "Hacked123!",
              passwordHash: "injected-hash",
              deletedAt: "2026-01-01T00:00:00Z",
              deletedBy: "u-evil",
              workspaceSubdomain: "other",
              profileJson: { evil: true },
            } as never,
          ],
          "admin",
        ),
      );

      expect(mocks.saveUsers).toHaveBeenCalledTimes(1);
      const saved = mocks.saveUsers.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        id: "u-1",
        name: "Target",
        email: "target@demo.local",
        role: "teacher",
        status: "active",
        twoFactorEnabled: false,
      });
      expect(saved[0]).not.toHaveProperty("temporaryPassword");
      expect(saved[0]).not.toHaveProperty("passwordHash");
      expect(saved[0]).not.toHaveProperty("deletedAt");
      expect(saved[0]).not.toHaveProperty("deletedBy");
      expect(saved[0]).not.toHaveProperty("workspaceSubdomain");
      expect(saved[0]).not.toHaveProperty("profileJson");
    });
  });

  describe("updateWorkspaceUserHelper self-protection", () => {
    const repo = { findTenantUserRowById: vi.fn() };

    it("rejects changing your own role", async () => {
      repo.findTenantUserRowById.mockResolvedValue({
        id: "u-self",
        workspaceSubdomain: "demo",
        role: "admin",
        status: "active",
        deletedAt: null,
      });

      await expect(
        runWithTenant("demo", () =>
          updateWorkspaceUserHelper(
            repo as never,
            "u-self",
            { role: "teacher" },
            "u-self",
            "admin",
          ),
        ),
      ).rejects.toMatchObject({ statusCode: 400, type: "self_role_change" });
    });

    it("rejects moving your own account off active", async () => {
      repo.findTenantUserRowById.mockResolvedValue({
        id: "u-self",
        workspaceSubdomain: "demo",
        role: "admin",
        status: "active",
        deletedAt: null,
      });

      await expect(
        runWithTenant("demo", () =>
          updateWorkspaceUserHelper(
            repo as never,
            "u-self",
            { status: "suspended" },
            "u-self",
            "admin",
          ),
        ),
      ).rejects.toMatchObject({ statusCode: 400, type: "self_status_change" });
    });
  });

  describe("last-active-admin guard", () => {
    const repo = { findTenantUserRowById: vi.fn() };

    it("rejects deleting the last active administrator", async () => {
      repo.findTenantUserRowById.mockResolvedValue({
        id: "u-admin",
        workspaceSubdomain: "demo",
        role: "admin",
        status: "active",
        deletedAt: null,
        name: "Admin",
      });
      mocks.getRawUsers.mockResolvedValue([{ id: "u-admin", role: "admin", status: "active" }]);

      await expect(
        runWithTenant("demo", () =>
          deleteUserByIdHelper(repo as never, "u-admin", "u-other", "admin"),
        ),
      ).rejects.toMatchObject({ statusCode: 403, type: "last_admin_delete" });
    });

    it("rejects demoting the last active administrator", async () => {
      repo.findTenantUserRowById.mockResolvedValue({
        id: "u-admin",
        workspaceSubdomain: "demo",
        role: "admin",
        status: "active",
        deletedAt: null,
      });
      mocks.getRawUsers.mockResolvedValue([{ id: "u-admin", role: "admin", status: "active" }]);

      await expect(
        runWithTenant("demo", () =>
          updateWorkspaceUserHelper(
            repo as never,
            "u-admin",
            { role: "teacher" },
            "u-other",
            "admin",
          ),
        ),
      ).rejects.toMatchObject({ statusCode: 403, type: "last_admin_mutation" });
    });

    it("rejects deactivating the last active administrator", async () => {
      repo.findTenantUserRowById.mockResolvedValue({
        id: "u-admin",
        workspaceSubdomain: "demo",
        role: "admin",
        status: "active",
        deletedAt: null,
      });
      mocks.getRawUsers.mockResolvedValue([{ id: "u-admin", role: "admin", status: "active" }]);

      await expect(
        runWithTenant("demo", () =>
          updateWorkspaceUserHelper(
            repo as never,
            "u-admin",
            { status: "suspended" },
            "u-other",
            "admin",
          ),
        ),
      ).rejects.toMatchObject({ statusCode: 403, type: "last_admin_mutation" });
    });
  });

  describe("platform-managed super admin role", () => {
    const repo = {
      findTenantUserRowById: vi.fn(),
      bulkSaveActivityLogs: vi.fn().mockResolvedValue(undefined),
    };

    it("rejects promoting a user to the platform-managed role", async () => {
      repo.findTenantUserRowById.mockResolvedValue({
        id: "u-teacher",
        workspaceSubdomain: "demo",
        role: "teacher",
        status: "active",
        deletedAt: null,
      });

      await expect(
        runWithTenant("demo", () =>
          updateWorkspaceUserHelper(
            repo as never,
            "u-teacher",
            { role: "super_admin" },
            "u-owner",
            "super_admin",
          ),
        ),
      ).rejects.toMatchObject({ statusCode: 403, type: "platform_managed_role" });
    });

    it("rejects demoting the apex super admin from the tenant users module", async () => {
      repo.findTenantUserRowById.mockResolvedValue({
        id: "u-owner",
        workspaceSubdomain: "demo",
        role: "super_admin",
        status: "active",
        deletedAt: null,
      });

      await expect(
        runWithTenant("demo", () =>
          updateWorkspaceUserHelper(
            repo as never,
            "u-owner",
            { role: "admin" },
            "u-other-owner",
            "super_admin",
          ),
        ),
      ).rejects.toMatchObject({ statusCode: 403, type: "platform_managed_role" });
    });

    it("allows editing other fields of the apex account without changing its role", async () => {
      repo.findTenantUserRowById.mockResolvedValue({
        id: "u-owner",
        workspaceSubdomain: "demo",
        role: "super_admin",
        status: "active",
        deletedAt: null,
      });
      mocks.getRawUsers.mockResolvedValue([
        { id: "u-owner", role: "super_admin", status: "active", name: "Owner" },
        { id: "u-admin", role: "admin", status: "active", name: "Admin" },
      ]);
      mocks.saveUsers.mockResolvedValue(undefined);

      await expect(
        runWithTenant("demo", () =>
          updateWorkspaceUserHelper(
            repo as never,
            "u-owner",
            { twoFactorEnabled: true },
            "u-owner",
            "super_admin",
          ),
        ),
      ).resolves.toBeDefined();
    });

    it("rejects creating or promoting a super admin through the bulk upsert", async () => {
      mocks.getHydratedUsers.mockResolvedValue([
        { id: "u-teacher", role: "teacher", status: "active" },
      ]);

      await expect(
        runWithTenant("demo", () =>
          upsertWorkspaceUsersHelper(
            [
              {
                id: "u-teacher",
                name: "Teacher",
                email: "teacher@demo.local",
                role: "super_admin",
                status: "active",
                twoFactorEnabled: false,
              },
            ] as never,
            "super_admin",
            undefined,
            "u-owner",
          ),
        ),
      ).rejects.toMatchObject({ statusCode: 403, type: "platform_managed_role" });
    });

    it("rejects mutating the apex super admin row through the bulk upsert", async () => {
      mocks.getHydratedUsers.mockResolvedValue([
        { id: "u-owner", role: "super_admin", status: "active" },
      ]);

      await expect(
        runWithTenant("demo", () =>
          upsertWorkspaceUsersHelper(
            [
              {
                id: "u-owner",
                name: "Owner",
                email: "owner@demo.local",
                role: "admin",
                status: "active",
                twoFactorEnabled: false,
              },
            ] as never,
            "super_admin",
            undefined,
            "u-owner",
          ),
        ),
      ).rejects.toMatchObject({ statusCode: 403, type: "platform_managed_role" });
    });
  });
});
