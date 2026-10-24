import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadContactsByIds } from "../services/contactService.js";
import type { Contact } from "@mms/shared";

const mockListTenantUsers = vi.fn();
const mockFindTenantUserById = vi.fn();
const mockReplaceTenantUsers = vi.fn();
const mockUpsertTenantUserRow = vi.fn();
const mockGetCollection = vi.fn();
const mockSaveCollection = vi.fn();
const mockHashPassword = vi.fn();
const mockVerifyPassword = vi.fn();
const mockGetRequestTenant = vi.fn();

vi.mock("../db/repositories/tenantUserRepository.js", () => ({
  listTenantUsersByWorkspace: (...args: unknown[]) => mockListTenantUsers(...args),
  findTenantUserRowById: (...args: unknown[]) => mockFindTenantUserById(...args),
  replaceTenantUsersForWorkspace: (...args: unknown[]) => mockReplaceTenantUsers(...args),
  upsertTenantUserRow: (...args: unknown[]) => mockUpsertTenantUserRow(...args),
  // The real signature is (workspaceSubdomain, users); the workspace is
  // authoritative and is asserted via the per-row payload's workspaceSubdomain.
  upsertTenantUsersBatch: vi.fn(async (_workspaceSubdomain: string, users: unknown[]) => {
    for (const u of users) {
      await mockUpsertTenantUserRow(u);
    }
  }),
}));

vi.mock("../db/database.js", () => ({
  getCollection: (...args: unknown[]) => mockGetCollection(...args),
  saveCollection: (...args: unknown[]) => mockSaveCollection(...args),
}));

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
}));

vi.mock("../services/auth/passwordService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/auth/passwordService.js")>();
  return {
    ...actual,
    hashPassword: (...args: unknown[]) => mockHashPassword(...args),
    verifyPassword: (...args: unknown[]) => mockVerifyPassword(...args),
  };
});

vi.mock("../services/contactService.js", () => ({
  loadContactsByIds: vi.fn().mockResolvedValue([]),
  getContactById: vi.fn().mockResolvedValue(null),
  updateContactById: vi.fn(),
}));

vi.mock("../services/globalSettingsService.js", () => ({
  assertPasswordMeetsPolicy: vi.fn().mockResolvedValue(undefined),
}));

import {
  changeTenantUserPassword,
  saveUsers,
  validateCredentials,
} from "../services/auth/userService.js";

describe("userService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHashPassword.mockImplementation(async (password: string) => `hashed:${password}`);
    mockVerifyPassword.mockResolvedValue(true);
    mockGetRequestTenant.mockReturnValue("dar-ul-quran");
    vi.mocked(loadContactsByIds).mockResolvedValue([]);
  });

  it("matches login by loginEmail not contact CRM email", async () => {
    mockListTenantUsers.mockResolvedValue([
      {
        id: "auth-1",
        role: "admin",
        contactId: "42",
        loginEmail: "admin@workspace.local",
        emailVerifiedAt: "2026-01-01T00:00:00.000Z",
        workspaceSubdomain: "dar-ul-quran",
        passwordHash: "salt:hash",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(loadContactsByIds).mockResolvedValue([
      {
        id: "42",
        name: "Syed Ahmed Ali Naqvi",
        emails: [{ address: "different@contact.local" }],
      } as Contact,
    ]);

    const result = await validateCredentials("admin@workspace.local", "secret", "dar-ul-quran");

    expect(mockVerifyPassword).toHaveBeenCalledWith("secret", "salt:hash");
    expect(loadContactsByIds).toHaveBeenCalledWith(["42"]);
    expect(result).toMatchObject({
      id: "auth-1",
      email: "admin@workspace.local",
      loginEmail: "admin@workspace.local",
      name: "Syed Ahmed Ali Naqvi",
    });
  });

  it("does not sign in with contact email when loginEmail differs", async () => {
    mockListTenantUsers.mockResolvedValue([
      {
        id: "auth-1",
        role: "admin",
        contactId: "42",
        loginEmail: "admin@workspace.local",
        emailVerifiedAt: "2026-01-01T00:00:00.000Z",
        workspaceSubdomain: "dar-ul-quran",
        passwordHash: "salt:hash",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    mockFindTenantUserById.mockResolvedValue(null);
    vi.mocked(loadContactsByIds).mockResolvedValue([
      {
        id: "42",
        name: "Admin",
        emails: [{ address: "different@contact.local" }],
      } as Contact,
    ]);

    const result = await validateCredentials("different@contact.local", "secret", "dar-ul-quran");

    expect(result).toBeNull();
  });

  it("stores temporary passwords as forced password changes for tenant users in any role", async () => {
    mockListTenantUsers.mockResolvedValue([]);

    await saveUsers([
      {
        id: "admin-1",
        name: "Admin User",
        email: "admin@workspace.local",
        loginEmail: "admin@workspace.local",
        phone: "",
        role: "admin",
        status: "active",
        temporaryPassword: "TempAdmin123!",
      },
      {
        id: "teacher-1",
        name: "Teacher User",
        email: "teacher@workspace.local",
        loginEmail: "teacher@workspace.local",
        phone: "",
        role: "teacher",
        status: "active",
        temporaryPassword: "TempTeacher123!",
      },
    ]);

    expect(mockHashPassword).toHaveBeenCalledWith("TempAdmin123!");
    expect(mockHashPassword).toHaveBeenCalledWith("TempTeacher123!");
    const savedUsers = mockUpsertTenantUserRow.mock.calls.map((call) => call[0]);
    expect(savedUsers).toEqual([
      expect.objectContaining({
        id: "admin-1",
        role: "admin",
        workspaceSubdomain: "dar-ul-quran",
        passwordHash: "hashed:TempAdmin123!",
        mustChangePassword: true,
      }),
      expect.objectContaining({
        id: "teacher-1",
        role: "teacher",
        workspaceSubdomain: "dar-ul-quran",
        passwordHash: "hashed:TempTeacher123!",
        mustChangePassword: true,
      }),
    ]);
    expect(savedUsers[0]).not.toHaveProperty("temporaryPassword");
    expect(savedUsers[1]).not.toHaveProperty("temporaryPassword");
  });

  it("clears the forced password change flag after changing the password", async () => {
    mockListTenantUsers.mockResolvedValue([
      {
        id: "teacher-1",
        name: "Teacher User",
        email: "teacher@workspace.local",
        loginEmail: "teacher@workspace.local",
        role: "teacher",
        workspaceSubdomain: "dar-ul-quran",
        passwordHash: "old-hash",
        mustChangePassword: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    await changeTenantUserPassword("teacher-1", "OldTemp123!", "NewTeacher123!");

    expect(mockVerifyPassword).toHaveBeenCalledWith("OldTemp123!", "old-hash");
    expect(mockHashPassword).toHaveBeenCalledWith("NewTeacher123!");
    const savedUsers = mockUpsertTenantUserRow.mock.calls.map((call) => call[0]);
    expect(savedUsers[0]).toMatchObject({
      id: "teacher-1",
      passwordHash: "hashed:NewTeacher123!",
      mustChangePassword: false,
    });
  });
});
