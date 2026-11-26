import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureIamUsersAdapters } from "../modules/iam/userAdapters.js";
import {
  createWorkspaceAdminUser,
  getWorkspaceAdminEmailsMap,
  listWorkspaceSuperAdminIds,
} from "@mms/mod-iam/backend/tenant/repository";

configureIamUsersAdapters();

const mockDbState = vi.hoisted(() => ({
  existingUsers: [] as Array<{
    id: string;
    workspaceSubdomain: string;
    subdomain?: string;
    email?: string;
    loginEmail: string;
    role?: string | null;
    deletedAt: Date | null;
  }>,
  insertedUsers: [] as Record<string, unknown>[],
  workspaceExists: true,
}));

const mockTenantDb = {
  execute: async () => [],
  select: () => ({
    from: () => ({
      where: async () => mockDbState.existingUsers,
    }),
  }),
  insert: () => ({
    values: async (vals: Record<string, unknown>) => {
      mockDbState.insertedUsers.push(vals);
      return [vals];
    },
  }),
};

vi.mock("../db/database.js", () => ({ getDb: () => mockTenantDb }));

// These are platform-admin operations; production wraps them in an explicit
// global tenant transaction (see workspaceAdminUserRepository.ts).
vi.mock("@mms/db/context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/db/context")>();
  return {
    ...actual,
    withGlobalTenant: (cb: (db: typeof mockTenantDb) => Promise<unknown>) => cb(mockTenantDb),
  };
});

vi.mock("../db/repositories/workspaceRepository.js", () => ({
  getWorkspaceWithBranding: async (subdomain: string) => {
    if (!mockDbState.workspaceExists) return null;
    return {
      workspace: { subdomain, madrasaName: "Test Madrasa", enabled: true },
      branding: null,
    };
  },
  getWorkspaceBranding: async () => null,
  listWorkspaceRowsWithBranding: async () => [],
  updateWorkspaceBrandingRow: async () => {},
  upsertWorkspaceBranding: async () => {},
}));

vi.mock("../services/auth/passwordService.js", () => ({
  hashPassword: async (pwd: string) => `hashed_${pwd}`,
}));

describe("createWorkspaceAdminUser", () => {
  beforeEach(() => {
    mockDbState.existingUsers = [];
    mockDbState.insertedUsers = [];
    mockDbState.workspaceExists = true;
    vi.clearAllMocks();
  });

  it("returns WORKSPACE_NOT_FOUND when workspace does not exist", async () => {
    mockDbState.workspaceExists = false;
    const result = await createWorkspaceAdminUser("nonexistent", {
      name: "Admin Name",
      email: "admin@test.org",
    });
    expect(result).toEqual({ success: false, error: "WORKSPACE_NOT_FOUND" });
  });

  it("returns USER_ALREADY_EXISTS when user with email already exists in workspace", async () => {
    mockDbState.existingUsers = [
      { id: "usr_123", workspaceSubdomain: "demo", loginEmail: "admin@test.org", deletedAt: null },
    ];
    const result = await createWorkspaceAdminUser("demo", {
      name: "Admin Name",
      email: "admin@test.org",
    });
    expect(result).toEqual({ success: false, error: "USER_ALREADY_EXISTS" });
  });

  it("promotes the first platform-created admin to super_admin when the tenant has none", async () => {
    // Changed intent: previously every platform-created admin was role "admin".
    // The tenant's first admin must be its ONLY super_admin (platform console review).
    const result = await createWorkspaceAdminUser("demo", {
      name: "New Admin",
      email: "newadmin@test.org",
      password: "CustomPassword123!",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.subdomain).toBe("demo");
      expect(result.adminEmail).toBe("newadmin@test.org");
      expect(result.name).toBe("New Admin");
      expect(result.initialPassword).toBe("CustomPassword123!");
    }

    expect(mockDbState.insertedUsers).toHaveLength(1);
    expect(mockDbState.insertedUsers[0]).toMatchObject({
      workspaceSubdomain: "demo",
      loginEmail: "newadmin@test.org",
      name: "New Admin",
      role: "super_admin",
      mustChangePassword: true,
      emailVerifiedAt: expect.any(Date),
      passwordHash: "hashed_CustomPassword123!",
    });
  });

  it("creates a plain admin when the tenant already has a super_admin", async () => {
    mockDbState.existingUsers = [
      {
        id: "usr_owner",
        subdomain: "demo",
        workspaceSubdomain: "demo",
        loginEmail: "owner@test.org",
        email: "owner@test.org",
        role: "super_admin",
        deletedAt: null,
      },
    ];
    const result = await createWorkspaceAdminUser("demo", {
      name: "Second Admin",
      email: "second@test.org",
    });

    expect(result.success).toBe(true);
    expect(mockDbState.insertedUsers).toHaveLength(1);
    expect(mockDbState.insertedUsers[0]).toMatchObject({
      loginEmail: "second@test.org",
      role: "admin",
    });
  });

  it("ignores soft-deleted super_admins when deciding the new admin role", async () => {
    mockDbState.existingUsers = [
      {
        id: "usr_gone",
        workspaceSubdomain: "demo",
        loginEmail: "gone@test.org",
        role: "super_admin",
        deletedAt: new Date("2026-01-01T00:00:00Z"),
      },
    ];
    await createWorkspaceAdminUser("demo", {
      name: "New Owner",
      email: "newowner@test.org",
    });

    expect(mockDbState.insertedUsers[0]).toMatchObject({ role: "super_admin" });
  });

  it("auto-generates initial password when password parameter is omitted", async () => {
    const result = await createWorkspaceAdminUser("demo", {
      name: "Auto Admin",
      email: "autoadmin@test.org",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.initialPassword).toMatch(/^Mms#/);
      expect(result.initialPassword.length).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("listWorkspaceSuperAdminIds", () => {
  beforeEach(() => {
    mockDbState.existingUsers = [];
    vi.clearAllMocks();
  });

  it("returns only the active super_admin ids of the workspace", async () => {
    mockDbState.existingUsers = [
      {
        id: "usr_owner",
        subdomain: "demo",
        workspaceSubdomain: "demo",
        loginEmail: "owner@test.org",
        email: "owner@test.org",
        role: "super_admin",
        deletedAt: null,
      },
      {
        id: "usr_admin",
        workspaceSubdomain: "demo",
        loginEmail: "admin@test.org",
        role: "admin",
        deletedAt: null,
      },
      {
        id: "usr_gone",
        workspaceSubdomain: "demo",
        loginEmail: "gone@test.org",
        role: "super_admin",
        deletedAt: new Date("2026-01-01T00:00:00Z"),
      },
    ];

    await expect(listWorkspaceSuperAdminIds("demo")).resolves.toEqual(["usr_owner"]);
  });

  it("returns an empty list when the workspace has no super_admin", async () => {
    mockDbState.existingUsers = [
      {
        id: "usr_admin",
        workspaceSubdomain: "demo",
        loginEmail: "admin@test.org",
        role: "admin",
        deletedAt: null,
      },
    ];

    await expect(listWorkspaceSuperAdminIds("demo")).resolves.toEqual([]);
  });
});

describe("getWorkspaceAdminEmailsMap", () => {
  beforeEach(() => {
    mockDbState.existingUsers = [];
    vi.clearAllMocks();
  });

  it("prefers the tenant apex super_admin over an earlier plain admin", async () => {
    mockDbState.existingUsers = [
      {
        id: "usr_old",
        subdomain: "demo",
        workspaceSubdomain: "demo",
        loginEmail: "old-admin@test.org",
        email: "old-admin@test.org",
        role: "admin",
        deletedAt: null,
        createdAt: new Date("2025-01-01T00:00:00Z"),
      },
      {
        id: "usr_owner",
        subdomain: "demo",
        workspaceSubdomain: "demo",
        loginEmail: "owner@test.org",
        email: "owner@test.org",
        role: "super_admin",
        deletedAt: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ] as never;

    await expect(getWorkspaceAdminEmailsMap(["demo"])).resolves.toEqual(
      new Map([["demo", "owner@test.org"]]),
    );
  });
});
