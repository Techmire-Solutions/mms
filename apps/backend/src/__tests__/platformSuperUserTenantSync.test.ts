import { describe, it, expect, beforeEach, vi } from "vitest";
import type { StoredPlatformUser } from "@mms/shared";
import type { Workspace } from "@mms/shared";
import type { TenantUserRow } from "../db/repositories/tenantUserRepositoryHydrate.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { hashPassword } from "../services/auth/passwordService.js";
import {
  findActivePlatformSuperUser,
  syncPlatformSuperUserToTenants,
} from "../services/platform/platformSuperUserTenantSyncService.js";
import { createWorkspace } from "../services/workspaceService.js";
import { listTenantUsersByWorkspace } from "../db/repositories/tenantUserRepository.js";
import { updatePlatformUserPassword } from "../services/platform/platformUserServicePassword.js";
import { validateCredentials } from "../services/auth/userServiceAuth.js";
import {
  deleteUserById,
  resetUserPasswordById,
  updateWorkspaceUser,
} from "../services/usersService.js";

const { mockPlatformUsers, mockWorkspaces, mockTenantUsers } = vi.hoisted(() => {
  const mockPlatformUsers: StoredPlatformUser[] = [];
  const mockWorkspaces: Workspace[] = [];
  const mockTenantUsers: TenantUserRow[] = [];
  return { mockPlatformUsers, mockWorkspaces, mockTenantUsers };
});

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
  closeDatabase: vi.fn().mockResolvedValue(undefined),
  runInTransaction: vi.fn().mockImplementation((cb) => cb()),
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: vi.fn().mockImplementation(async (tenantId: string | null | undefined, cb) => {
    const mockTx = {
      select: () => ({
        from: () => ({
          where: () => {
            if (!tenantId) return mockTenantUsers;
            return mockTenantUsers.filter(
              (u) =>
                (u.workspaceSubdomain || "").toLowerCase() === tenantId.toLowerCase() &&
                !u.deletedAt,
            );
          },
        }),
      }),
      insert: () => ({
        values: async (data: Record<string, unknown> | Record<string, unknown>[]) => {
          const arr = Array.isArray(data) ? data : [data];
          for (const item of arr) {
            mockTenantUsers.push({
              id: String(item.id),
              workspaceSubdomain: String(item.workspaceSubdomain),
              loginEmail: String(item.loginEmail),
              email: String(item.loginEmail),
              passwordHash: String(item.passwordHash),
              name: String(item.name || ""),
              role: String(item.role || "assistant_teacher"),
              emailVerifiedAt: item.emailVerifiedAt ? String(item.emailVerifiedAt) : undefined,
              createdAt: new Date().toISOString(),
              mustChangePassword: Boolean(item.mustChangePassword),
              deletedAt: null,
              deletedBy: null,
            });
          }
        },
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => ({
          where: () => {
            for (let i = 0; i < mockTenantUsers.length; i++) {
              const u = mockTenantUsers[i];
              if (
                !tenantId ||
                (u.workspaceSubdomain || "").toLowerCase() === tenantId.toLowerCase()
              ) {
                mockTenantUsers[i] = {
                  ...u,
                  ...(patch.name ? { name: String(patch.name) } : {}),
                  ...(patch.loginEmail
                    ? { loginEmail: String(patch.loginEmail), email: String(patch.loginEmail) }
                    : {}),
                  ...(patch.passwordHash ? { passwordHash: String(patch.passwordHash) } : {}),
                  ...(patch.role ? { role: String(patch.role) } : {}),
                  ...(patch.emailVerifiedAt
                    ? { emailVerifiedAt: String(patch.emailVerifiedAt) }
                    : {}),
                  ...(patch.deletedAt !== undefined
                    ? { deletedAt: patch.deletedAt ? String(patch.deletedAt) : null }
                    : {}),
                  ...(patch.deletedBy !== undefined
                    ? { deletedBy: patch.deletedBy ? String(patch.deletedBy) : null }
                    : {}),
                };
              }
            }
          },
        }),
      }),
      delete: () => ({
        where: () => {
          if (!tenantId) {
            mockTenantUsers.length = 0;
          } else {
            const rem = mockTenantUsers.filter(
              (u) => (u.workspaceSubdomain || "").toLowerCase() !== tenantId.toLowerCase(),
            );
            mockTenantUsers.length = 0;
            mockTenantUsers.push(...rem);
          }
        },
      }),
    };
    return cb(mockTx);
  }),
}));

vi.mock("../db/repositories/platformUserRepository.js", () => ({
  findPlatformUserRowByRole: vi.fn().mockImplementation(async (role: string) => {
    return mockPlatformUsers.find((u) => u.role === role) ?? null;
  }),
  findPlatformUserRowByEmail: vi.fn().mockImplementation(async (email: string) => {
    return (
      mockPlatformUsers.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) ?? null
    );
  }),
  findPlatformUserRowById: vi.fn().mockImplementation(async (id: string) => {
    return mockPlatformUsers.find((u) => u.id === id) ?? null;
  }),
  listPlatformUsers: vi.fn().mockImplementation(async () => [...mockPlatformUsers]),
  countPlatformUserRows: vi.fn().mockImplementation(async () => mockPlatformUsers.length),
  insertPlatformUser: vi.fn().mockImplementation(async (u: StoredPlatformUser) => {
    mockPlatformUsers.push(u);
    return u;
  }),
  updatePlatformUserRow: vi
    .fn()
    .mockImplementation(async (id: string, patch: Partial<StoredPlatformUser>) => {
      const idx = mockPlatformUsers.findIndex((u) => u.id === id);
      if (idx === -1) return null;
      mockPlatformUsers[idx] = { ...mockPlatformUsers[idx], ...patch };
      return mockPlatformUsers[idx];
    }),
}));

vi.mock("../db/repositories/platformActivityLogsRepository.js", () => ({
  insertPlatformActivityLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../db/repositories/workspaceRepository.js", () => ({
  listWorkspaceRows: vi.fn().mockImplementation(async () => [...mockWorkspaces]),
  findWorkspaceRowBySubdomain: vi.fn().mockImplementation(async (subdomain: string) => {
    return (
      mockWorkspaces.find((ws) => ws.subdomain.toLowerCase() === subdomain.trim().toLowerCase()) ??
      null
    );
  }),
  insertWorkspaceRow: vi.fn().mockImplementation(async (ws: Workspace) => {
    mockWorkspaces.push(ws);
  }),
  getWorkspaceBranding: vi.fn().mockResolvedValue(null),
}));

vi.mock("../db/repositories/tenantUserRepository.js", () => ({
  listTenantUsersByWorkspace: vi.fn().mockImplementation(async (subdomain: string) => {
    return mockTenantUsers.filter(
      (u) =>
        (u.workspaceSubdomain || "").toLowerCase() === subdomain.trim().toLowerCase() &&
        !u.deletedAt,
    );
  }),
  // Mirrors the real repository: id lookups are ALWAYS scoped to the caller's
  // workspace (tenantUserRepositoryHydrate.ts). Keeping the tenant predicate in
  // the fake is what makes these cross-tenant assertions meaningful.
  findTenantUserRowById: vi.fn().mockImplementation(async (tenant: string, id: string) => {
    const target = tenant.trim().toLowerCase();
    return (
      mockTenantUsers.find(
        (u) => u.id === id && (u.workspaceSubdomain || "").toLowerCase() === target,
      ) ?? null
    );
  }),
  upsertTenantUserRow: vi.fn().mockImplementation(async (tenant: string, row: TenantUserRow) => {
    const scoped = { ...row, workspaceSubdomain: tenant.trim().toLowerCase() };
    const idx = mockTenantUsers.findIndex((u) => u.id === scoped.id);
    if (idx >= 0) {
      mockTenantUsers[idx] = { ...mockTenantUsers[idx], ...scoped };
    } else {
      mockTenantUsers.push(scoped);
    }
  }),
  softDeleteTenantUserRow: vi
    .fn()
    .mockImplementation(async (tenant: string, id: string, deletedBy: string) => {
      const target = tenant.trim().toLowerCase();
      const idx = mockTenantUsers.findIndex(
        (u) => u.id === id && (u.workspaceSubdomain || "").toLowerCase() === target,
      );
      if (idx >= 0) {
        mockTenantUsers[idx].deletedAt = new Date().toISOString();
        mockTenantUsers[idx].deletedBy = deletedBy;
        return true;
      }
      return false;
    }),
  resetTenantUserPasswordRow: vi
    .fn()
    .mockImplementation(async (tenant: string, id: string, passwordHash: string) => {
      const target = tenant.trim().toLowerCase();
      const idx = mockTenantUsers.findIndex(
        (u) => u.id === id && (u.workspaceSubdomain || "").toLowerCase() === target,
      );
      if (idx >= 0) {
        mockTenantUsers[idx].passwordHash = passwordHash;
        return true;
      }
      return false;
    }),
  verifyTenantUserEmailRow: vi.fn().mockResolvedValue(true),
  restoreTenantUserRow: vi.fn().mockResolvedValue(true),
  listTenantUsersByIds: vi.fn().mockImplementation(async (tenant: string, ids: string[]) => {
    const target = tenant.trim().toLowerCase();
    return mockTenantUsers.filter(
      (u) => ids.includes(u.id) && (u.workspaceSubdomain || "").toLowerCase() === target,
    );
  }),
}));

vi.mock("../services/auth/userServiceShared.js", () => ({
  requireTenantSubdomain: vi.fn().mockImplementation(() => {
    const { getRequestTenant } = vi.importActual("../lib/tenantContext.js") as unknown as {
      getRequestTenant: () => string;
    };
    return (getRequestTenant() || "test").toLowerCase();
  }),
  getRawUsers: vi.fn().mockImplementation(async () => [...mockTenantUsers]),
  getContactsForUsers: vi.fn().mockResolvedValue([]),
  hydratedEmail: (u: { email?: string; loginEmail?: string }) => u.loginEmail || u.email || "",
  asAuthUser: (u: TenantUserRow) => ({
    id: u.id,
    email: u.loginEmail,
    loginEmail: u.loginEmail,
    name: u.name,
    role: u.role,
    workspaceSubdomain: u.workspaceSubdomain,
    passwordHash: u.passwordHash,
    createdAt: u.createdAt,
    emailVerifiedAt: u.emailVerifiedAt,
    mustChangePassword: u.mustChangePassword,
  }),
  toPublicUser: (u: {
    id: string;
    loginEmail: string;
    name: string;
    role: string;
    workspaceSubdomain: string;
    emailVerifiedAt?: string;
    mustChangePassword?: boolean;
  }) => ({
    id: u.id,
    email: u.loginEmail,
    loginEmail: u.loginEmail,
    name: u.name,
    role: u.role,
    workspaceSubdomain: u.workspaceSubdomain,
    emailVerifiedAt: u.emailVerifiedAt,
    mustChangePassword: u.mustChangePassword,
  }),
}));

vi.mock("../services/auth/userServiceList.js", () => ({
  getHydratedUsers: vi.fn().mockImplementation(async () => [...mockTenantUsers]),
  saveUsers: vi.fn().mockImplementation(async (users: TenantUserRow[]) => {
    mockTenantUsers.length = 0;
    mockTenantUsers.push(...users);
  }),
  getWorkspaceUserRow: vi.fn().mockImplementation(async (id: string) => {
    return mockTenantUsers.find((u) => u.id === id);
  }),
  getLinkedContactId: vi.fn().mockResolvedValue(null),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn(),
  broadcastTenantUpdate: vi.fn(),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  deleteRefreshTokensForUser: vi.fn(),
}));

vi.mock("../services/authSessionService.js", () => ({
  revokeAllUserSessions: vi.fn(),
}));

vi.mock("../services/globalSettingsService.js", () => ({
  assertPasswordMeetsPolicy: vi.fn().mockReturnValue(true),
}));

vi.mock("../db/repositories/logsRepository.js", () => ({
  listActivityLogsByWorkspace: vi.fn().mockResolvedValue([]),
  findActivityLogById: vi.fn().mockResolvedValue(null),
  findActivityLogsByIds: vi.fn().mockResolvedValue([]),
  saveActivityLog: vi.fn().mockResolvedValue(undefined),
  bulkSaveActivityLogs: vi.fn(),
  replaceActivityLogsForWorkspace: vi.fn(),
}));

describe("Platform Superuser to Tenant Synchronization", () => {
  const testSuperEmail = "superplatform@madrasa.test";
  const testPassword = "SuperSecret123!";
  const platformSuperId = "p_super_1";

  beforeEach(async () => {
    mockPlatformUsers.length = 0;
    mockWorkspaces.length = 0;
    mockTenantUsers.length = 0;

    const passwordHash = await hashPassword(testPassword);

    mockPlatformUsers.push({
      id: platformSuperId,
      email: testSuperEmail,
      name: "Global Apex Superuser",
      passwordHash,
      role: "super_user",
      permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: true },
      sessionVersion: 0,
      createdAt: new Date().toISOString(),
      emailVerifiedAt: new Date().toISOString(),
    });
  });

  it("findActivePlatformSuperUser returns the seeded platform superuser", async () => {
    const superUser = await findActivePlatformSuperUser();
    expect(superUser).not.toBeNull();
    expect(superUser?.email).toBe(testSuperEmail);
    expect(superUser?.role).toBe("super_user");
  });

  it("automatically syncs platform superuser to newly created workspaces", async () => {
    const subdomain = "darululoom";
    await createWorkspace({
      subdomain,
      madrasaName: "Darul Uloom",
    });

    const tenantUsersList = await listTenantUsersByWorkspace(subdomain);
    expect(tenantUsersList.length).toBeGreaterThan(0);

    const superInTenant = tenantUsersList.find((u) => u.loginEmail === testSuperEmail);
    expect(superInTenant).toBeDefined();
    expect(superInTenant?.role).toBe("super_admin");
    expect(superInTenant?.name).toBe("Global Apex Superuser");
  });

  it("syncPlatformSuperUserToTenants syncs across multiple workspaces", async () => {
    const sub1 = "madrasa-one";
    const sub2 = "madrasa-two";

    await createWorkspace({ subdomain: sub1, madrasaName: "Madrasa One" });
    await createWorkspace({ subdomain: sub2, madrasaName: "Madrasa Two" });

    const synced = await syncPlatformSuperUserToTenants();
    expect(synced).toBeGreaterThanOrEqual(2);

    const users1 = await listTenantUsersByWorkspace(sub1);
    const users2 = await listTenantUsersByWorkspace(sub2);

    expect(users1.some((u) => u.loginEmail === testSuperEmail && u.role === "super_admin")).toBe(
      true,
    );
    expect(users2.some((u) => u.loginEmail === testSuperEmail && u.role === "super_admin")).toBe(
      true,
    );
  });

  it("updates all tenant user records when platform superuser password changes", async () => {
    const subdomain = "jamia-test";
    await createWorkspace({ subdomain, madrasaName: "Jamia Test" });

    const newPassword = "NewSuperSecret456!";
    const newHash = await hashPassword(newPassword);
    await updatePlatformUserPassword(platformSuperId, newHash);

    const successLogin = await runWithTenant(subdomain, () =>
      validateCredentials(testSuperEmail, newPassword, subdomain),
    );
    expect(successLogin).not.toBeNull();
    expect(successLogin?.role).toBe("super_admin");
    expect(successLogin?.loginEmail).toBe(testSuperEmail);
  });

  it("allows platform superuser to authenticate on any tenant workspace seamlessly", async () => {
    const subdomain = "al-noor";
    await createWorkspace({ subdomain, madrasaName: "Al Noor" });

    const user = await runWithTenant(subdomain, () =>
      validateCredentials(testSuperEmail, testPassword, subdomain),
    );

    expect(user).not.toBeNull();
    expect(user?.loginEmail).toBe(testSuperEmail);
    expect(user?.role).toBe("super_admin");
  });

  it("prevents regular tenant admins from deleting or mutating the platform super user in a tenant", async () => {
    const subdomain = "protection-test";
    await createWorkspace({ subdomain, madrasaName: "Protection Test" });

    const tenantUsersList = await listTenantUsersByWorkspace(subdomain);
    const superTenantUser = tenantUsersList.find((u) => u.loginEmail === testSuperEmail);
    expect(superTenantUser).toBeDefined();

    // An admin attempting to delete super_admin
    await expect(
      runWithTenant(subdomain, () => deleteUserById(superTenantUser!.id, "admin_user_id", "admin")),
    ).rejects.toThrow(/Cannot delete a Super Admin/);

    // An admin attempting to reset password of super_admin
    await expect(
      runWithTenant(subdomain, () =>
        resetUserPasswordById(superTenantUser!.id, "TempPass123!", "admin"),
      ),
    ).rejects.toThrow(/Cannot reset password of a Super Admin/);

    // An admin attempting to edit super_admin
    await expect(
      runWithTenant(subdomain, () =>
        updateWorkspaceUser(superTenantUser!.id, { role: "teacher" }, "admin_user_id", "admin"),
      ),
    ).rejects.toThrow(/Cannot modify a Super Admin/);
  });
});
