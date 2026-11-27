import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUsersUseCases } from "@mms/mod-iam/backend/tenant/use-cases";
import type { UsersRepository } from "@mms/mod-iam/backend/tenant/repository";
import { runWithTenant } from "@mms/be-core/http";
import type { HttpDomainError } from "@mms/be-core/http/errors";
import { configureIamUsersAdapters } from "../modules/iam/userAdapters.js";

const mockFindFacultyByContactId = vi.fn();
const mockListFacultyDesignations = vi.fn();
const mockGetHydratedUsers = vi.fn();
const mockSaveUsers = vi.fn();
const mockGetRawUsers = vi.fn();
const mockUpsertFacultyManagedWorkspaceRole = vi.fn();
const mockGetTenantUsersSettings = vi.fn();

vi.mock("@mms/mod-faculty/backend/repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-faculty/backend/repository")>()),
  findFacultyByContactId: (...args: unknown[]) => mockFindFacultyByContactId(...args),
  listFacultyDesignations: (...args: unknown[]) => mockListFacultyDesignations(...args),
}));

vi.mock("@mms/mod-faculty/backend/use-cases", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-faculty/backend/use-cases")>()),
  upsertFacultyManagedWorkspaceRole: (...args: unknown[]) =>
    mockUpsertFacultyManagedWorkspaceRole(...args),
  removeFacultyManagedWorkspaceRole: vi.fn(),
  mergeWorkspaceRolesForPrefsSave: vi.fn((incoming) => incoming),
}));

vi.mock("@mms/mod-iam/backend/tenant/services/usersSettingsService", () => ({
  getTenantUsersSettings: (...args: unknown[]) => mockGetTenantUsersSettings(...args),
}));

configureIamUsersAdapters();

vi.mock("../services/auth/userService.js", () => ({
  getHydratedUsers: (...args: unknown[]) => mockGetHydratedUsers(...args),
  saveUsers: (...args: unknown[]) => mockSaveUsers(...args),
}));

vi.mock("../services/auth/userServiceShared.js", () => ({
  getRawUsers: (...args: unknown[]) => mockGetRawUsers(...args),
}));

// The activity-log bridge now awaits its audit append inside the same tenant
// transaction (users/use-cases/userActivityLogUseCases.ts); this suite asserts
// role unioning, not the audit chain.
vi.mock("@mms/be-core/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/be-core/audit")>();
  return {
    ...actual,
    recordModernAuditEvent: vi.fn().mockResolvedValue({
      hashPrevious: "",
      hashCurrent: "",
      canonicalPayload: "",
    }),
  };
});

vi.mock("@mms/be-core/realtime", () => ({
  broadcastCollection: vi.fn(),
  broadcastTenantUpdate: vi.fn(),
  configureModuleAccessInvalidator: vi.fn(),
}));

vi.mock("@mms/be-core/rbac", () => ({
  invalidateTenantRbac: vi.fn(),
}));

vi.mock("@mms/mod-contacts/backend/services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-contacts/backend/services")>()),
  loadContactsByIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("@mms/mod-faculty/backend/deps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-faculty/backend/deps")>()),
  loadContactsByIds: vi.fn().mockResolvedValue([]),
  getTenantUsersSettings: (...args: unknown[]) => mockGetTenantUsersSettings(...args),
}));

vi.mock("../services/globalSettingsService.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/globalSettingsService.js")>()),
  assertPasswordMeetsPolicy: vi.fn(),
}));

vi.mock("../services/auth/passwordService.js", () => ({
  hashPassword: vi.fn().mockResolvedValue("hash"),
}));

function createFakeRepo(): UsersRepository {
  return {
    listTenantUsersPage: vi
      .fn()
      .mockResolvedValue({ rows: [], total: 0, page: 1, limit: 50, hasMore: false }),
    countTenantUsersActive: vi.fn().mockResolvedValue(0),
    aggregateUsersCommandMetrics: vi.fn().mockResolvedValue({
      total: 0,
      active: 0,
      suspended: 0,
      admins: 0,
      twoFaEnabled: 0,
      activeSessions: 0,
    }),
    listTenantUsersByIds: vi.fn().mockResolvedValue([]),
    findTenantUserRowById: vi.fn().mockResolvedValue(null),
    softDeleteTenantUserRow: vi.fn().mockResolvedValue(true),
    restoreTenantUserRow: vi.fn().mockResolvedValue(true),
    verifyTenantUserEmailRow: vi.fn().mockResolvedValue(true),
    resetTenantUserPasswordRow: vi.fn().mockResolvedValue(true),
    listActivityLogsByWorkspace: vi.fn().mockResolvedValue([]),
    findActivityLogById: vi.fn().mockResolvedValue(null),
    findActivityLogsByIds: vi.fn().mockResolvedValue([]),
    saveActivityLog: vi.fn().mockResolvedValue(undefined),
    bulkSaveActivityLogs: vi.fn().mockResolvedValue(undefined),
    replaceActivityLogsForWorkspace: vi.fn().mockResolvedValue(undefined),
  };
}

const multiTenureFaculty = {
  id: "f1",
  contactId: "c1",
  designationId: "d1",
  employDesignations: [
    { designationId: "d1", employDesignationStatus: "active", designationEndDate: null },
    { designationId: "d2", employDesignationStatus: "active", designationEndDate: null },
  ],
};

describe("faculty designation role assignment on users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHydratedUsers.mockResolvedValue([]);
    mockGetRawUsers.mockResolvedValue([]);
    mockSaveUsers.mockResolvedValue(undefined);
    mockGetTenantUsersSettings.mockResolvedValue({ workspaceRoles: [] });
    mockUpsertFacultyManagedWorkspaceRole.mockResolvedValue(undefined);
  });

  it("forces a managed composite role on create when multiple designation roles apply", async () => {
    mockFindFacultyByContactId.mockResolvedValue(multiTenureFaculty);
    mockListFacultyDesignations.mockResolvedValue([
      { id: "d1", status: "active", assignableRoles: ["teacher"] },
      { id: "d2", status: "active", assignableRoles: ["principal"] },
    ]);

    const useCases = createUsersUseCases(createFakeRepo());
    await expect(
      runWithTenant("demo", () =>
        useCases.createWorkspaceUser(
          {
            name: "A",
            email: "a@example.com",
            role: "teacher",
            contactId: "c1",
            status: "active",
            setupMethod: "password",
            password: "TempPass1!",
            twoFactorEnabled: false,
          },
          "actor",
          "admin",
        ),
      ),
    ).resolves.toMatchObject({
      user: expect.objectContaining({
        role: "faculty_ed_c1",
        roleSource: "faculty_designations",
      }),
    });
    expect(mockUpsertFacultyManagedWorkspaceRole).toHaveBeenCalled();
  });

  it("rejects manual role changes when faculty designations lock the role", async () => {
    mockFindFacultyByContactId.mockResolvedValue(multiTenureFaculty);
    mockListFacultyDesignations.mockResolvedValue([
      { id: "d1", status: "active", assignableRoles: ["teacher"] },
      { id: "d2", status: "active", assignableRoles: ["principal"] },
    ]);

    const repo = createFakeRepo();
    vi.mocked(repo.findTenantUserRowById).mockResolvedValue({
      id: "u1",
      role: "faculty_ed_c1",
      contactId: "c1",
      workspaceSubdomain: "demo",
    } as never);
    mockGetRawUsers.mockResolvedValue([
      {
        id: "u1",
        role: "faculty_ed_c1",
        contactId: "c1",
        name: "A",
        email: "a@example.com",
      },
    ]);

    const useCases = createUsersUseCases(repo);
    await expect(
      runWithTenant("demo", () =>
        useCases.updateWorkspaceUser("u1", { role: "accountant" }, "actor", "admin"),
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      type: "faculty_role_locked",
    } satisfies Partial<HttpDomainError>);
  });
});
