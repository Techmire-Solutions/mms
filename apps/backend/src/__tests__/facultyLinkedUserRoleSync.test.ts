import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncFacultyLinkedUserRole } from "../faculty/use-cases/facultyLinkedUserRoleSync.js";

const mockFindTenantUserRowByContactId = vi.fn();
const mockUpsertTenantUserRow = vi.fn();
const mockListFacultyDesignations = vi.fn();
const mockGetTenantUsersSettings = vi.fn();
const mockInvalidateTenantRbac = vi.fn();
const mockBroadcastCollection = vi.fn();
const mockUpsertFacultyManagedWorkspaceRole = vi.fn();
const mockRemoveFacultyManagedWorkspaceRole = vi.fn();

vi.mock("../db/repositories/tenantUserRepository.js", () => ({
  findTenantUserRowByContactId: (...args: unknown[]) => mockFindTenantUserRowByContactId(...args),
  upsertTenantUserRow: (...args: unknown[]) => mockUpsertTenantUserRow(...args),
}));

vi.mock("../db/repositories/facultyDesignationRepository.js", () => ({
  listFacultyDesignations: (...args: unknown[]) => mockListFacultyDesignations(...args),
}));

vi.mock("../services/users/usersSettingsService.js", () => ({
  getTenantUsersSettings: (...args: unknown[]) => mockGetTenantUsersSettings(...args),
}));

vi.mock("../services/rbacService.js", () => ({
  invalidateTenantRbac: (...args: unknown[]) => mockInvalidateTenantRbac(...args),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcastCollection(...args),
}));

vi.mock("../faculty/use-cases/facultyManagedRolesPrefs.js", () => ({
  upsertFacultyManagedWorkspaceRole: (...args: unknown[]) =>
    mockUpsertFacultyManagedWorkspaceRole(...args),
  removeFacultyManagedWorkspaceRole: (...args: unknown[]) =>
    mockRemoveFacultyManagedWorkspaceRole(...args),
}));

describe("syncFacultyLinkedUserRole (composite)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantUsersSettings.mockResolvedValue({ workspaceRoles: [] });
    mockUpsertTenantUserRow.mockResolvedValue(undefined);
    mockInvalidateTenantRbac.mockResolvedValue(undefined);
    mockBroadcastCollection.mockResolvedValue(undefined);
    mockUpsertFacultyManagedWorkspaceRole.mockResolvedValue(undefined);
    mockRemoveFacultyManagedWorkspaceRole.mockResolvedValue(undefined);
  });

  it("creates a managed composite role for multiple assignable designations", async () => {
    mockFindTenantUserRowByContactId.mockResolvedValue({
      id: "u1",
      role: "teacher",
      contactId: "c1",
      loginEmail: "a@b.c",
      passwordHash: "x",
      name: "A",
      workspaceSubdomain: "demo",
    });
    mockListFacultyDesignations.mockResolvedValue([
      { id: "d1", status: "active", assignableRoles: ["teacher"] },
      { id: "d2", status: "active", assignableRoles: ["accountant"] },
    ]);

    const result = await syncFacultyLinkedUserRole("demo", {
      contactId: "c1",
      employDesignations: [
        { designationId: "d1", employDesignationStatus: "active", designationEndDate: null },
        { designationId: "d2", employDesignationStatus: "active", designationEndDate: null },
      ],
    });

    expect(result.updated).toBe(true);
    expect(result.roleId).toBe("faculty_ed_c1");
    expect(mockUpsertFacultyManagedWorkspaceRole).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        id: "faculty_ed_c1",
        managedBy: "faculty_designations",
      }),
    );
    expect(mockUpsertTenantUserRow).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        role: "faculty_ed_c1",
        roleSource: "faculty_designations",
      }),
    );
  });

  it("assigns catalog role for a single assignable designation", async () => {
    mockFindTenantUserRowByContactId.mockResolvedValue({
      id: "u1",
      role: "assistant_teacher",
      contactId: "c1",
      loginEmail: "a@b.c",
      passwordHash: "x",
      name: "A",
      workspaceSubdomain: "demo",
    });
    mockListFacultyDesignations.mockResolvedValue([
      { id: "d1", status: "active", assignableRoles: ["teacher"] },
    ]);

    const result = await syncFacultyLinkedUserRole("demo", {
      contactId: "c1",
      employDesignations: [
        { designationId: "d1", employDesignationStatus: "active", designationEndDate: null },
      ],
    });

    expect(result).toEqual({ updated: true, roleId: "teacher" });
    expect(mockUpsertFacultyManagedWorkspaceRole).not.toHaveBeenCalled();
    expect(mockUpsertTenantUserRow).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ role: "teacher", roleSource: "faculty_designations" }),
    );
  });

  it("does not change role when assignable lists are empty", async () => {
    mockFindTenantUserRowByContactId.mockResolvedValue({
      id: "u1",
      role: "teacher",
      contactId: "c1",
      loginEmail: "a@b.c",
      passwordHash: "x",
      name: "A",
      workspaceSubdomain: "demo",
    });
    mockListFacultyDesignations.mockResolvedValue([
      { id: "d1", status: "active", assignableRoles: [] },
    ]);

    const result = await syncFacultyLinkedUserRole("demo", {
      contactId: "c1",
      employDesignations: [
        { designationId: "d1", employDesignationStatus: "active", designationEndDate: null },
      ],
    });

    expect(result).toEqual({ updated: false });
    expect(mockUpsertTenantUserRow).not.toHaveBeenCalled();
  });
});
