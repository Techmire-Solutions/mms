import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceRole } from "@mms/shared";

const mockSettings = vi.fn();
const mockRole = vi.fn();
const mockGetOrSet = vi.fn();
const mockInvalidate = vi.fn();

vi.mock("../services/users/usersSettingsService.js", () => ({
  getTenantUsersSettings: (...args: unknown[]) => mockSettings(...args),
}));

vi.mock("../lib/currentTenantRole.js", () => ({
  resolveCurrentTenantRole: (...args: unknown[]) => mockRole(...args),
}));

vi.mock("../lib/cache/index.js", () => ({
  getOrSetMultiTier: (...args: unknown[]) => mockGetOrSet(...args),
  invalidateMultiTierCache: (...args: unknown[]) => mockInvalidate(...args),
}));

import {
  getTenantRoleCatalog,
  tenantRoleHasPermission,
  tenantUserHasPermission,
} from "../lib/tenantRoleCatalog.js";
import { invalidateTenantRbac } from "../services/rbacService.js";

const composite: WorkspaceRole = {
  id: "faculty_ed_c1",
  labelKey: "nav.tasks",
  descriptionKey: "nav.tasks",
  isSystem: false,
  badgeVariant: "primary",
  permissions: { students: ["read"] },
};

describe("tenant role catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings.mockResolvedValue({ workspaceRoles: [composite] });
    mockGetOrSet.mockImplementation(
      async (_tenant: string, _domain: string, _key: string, fetcher: () => Promise<unknown>) =>
        fetcher(),
    );
  });

  it("loads custom roles from tenant settings and drops system-id shadows", async () => {
    mockSettings.mockResolvedValue({
      workspaceRoles: [
        composite,
        { ...composite, id: "teacher", permissions: { students: ["read", "update"] } },
      ],
    });

    const catalog = await getTenantRoleCatalog("demo");

    expect(catalog.map((role) => role.id)).toEqual(["faculty_ed_c1"]);
    expect(mockGetOrSet).toHaveBeenCalledWith("demo", "rbac", "catalog", expect.any(Function), {
      ttlSeconds: 3600,
    });
  });

  it("does not read the catalog for a system role", async () => {
    await expect(tenantRoleHasPermission("demo", "teacher", "students.read")).resolves.toBe(true);
    expect(mockGetOrSet).not.toHaveBeenCalled();
  });

  it("grants a custom role only its catalog permission", async () => {
    await expect(tenantRoleHasPermission("demo", "faculty_ed_c1", "students.read")).resolves.toBe(
      true,
    );
    await expect(tenantRoleHasPermission("demo", "faculty_ed_c1", "students.delete")).resolves.toBe(
      false,
    );
  });

  it("evaluates a job against the user's current role", async () => {
    mockRole.mockResolvedValue("faculty_ed_c1");
    await expect(tenantUserHasPermission("demo", "u-1", "students.read")).resolves.toBe(true);

    mockRole.mockResolvedValue(null);
    await expect(tenantUserHasPermission("demo", "u-1", "students.read")).resolves.toBe(false);
  });

  it("invalidates the whole rbac domain so matrix and catalog both refresh", async () => {
    await invalidateTenantRbac("demo");

    expect(mockInvalidate).toHaveBeenCalledWith({ tenantId: "demo", domain: "rbac" });
  });
});
