import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceAdminUser } from "../services/workspacePresentationService.js";

const mockDbState = vi.hoisted(() => ({
  existingUsers: [] as Array<{
    id: string;
    workspaceSubdomain: string;
    loginEmail: string;
    deletedAt: Date | null;
  }>,
  insertedUsers: [] as Record<string, unknown>[],
  workspaceExists: true,
}));

const mockTenantDb = {
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
vi.mock("../db/tenant-context.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/tenant-context.js")>();
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

describe("createWorkspaceAdminUser service", () => {
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

  it("creates admin user with custom password when valid", async () => {
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
      role: "admin",
      mustChangePassword: true,
      passwordHash: "hashed_CustomPassword123!",
    });
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
