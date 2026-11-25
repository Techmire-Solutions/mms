vi.mock("@mms/mod-contacts/backend/use-cases", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/mod-contacts/backend/use-cases")>();
  return {
    ...actual,
    ...{
      createAdminFirstContact: mocks.createAdminFirstContact,
    },
  };
});

vi.mock("@mms/mod-contacts/backend/services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/mod-contacts/backend/services")>();
  return {
    ...actual,
    ...{
      createAdminFirstContact: mocks.createAdminFirstContact,
    },
  };
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminFirstContact: vi.fn<() => Promise<string>>(),
  createUser: vi.fn(),
  listWorkspaceSuperAdminIds: vi.fn<() => Promise<string[]>>(),
}));

vi.mock("../services/auth/userService.js", () => ({
  createUser: mocks.createUser,
}));

vi.mock("../services/workspaceService.js", () => ({
  listWorkspaceSuperAdminIds: mocks.listWorkspaceSuperAdminIds,
}));

import { provisionWorkspaceAdmin } from "../services/workspaceAdminProvisioningService.js";

describe("provisionWorkspaceAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAdminFirstContact.mockResolvedValue("ctc_test_1");
    mocks.createUser.mockImplementation(
      async (
        email: string,
        name: string,
        _password: string,
        role: string,
        subdomain: string,
        options?: { contactId?: string | number },
      ) => ({
        id: "usr_test_1",
        loginEmail: email,
        name,
        role,
        workspaceSubdomain: subdomain,
        contactId: options?.contactId ?? null,
      }),
    );
  });

  it("provisions the madrasa admin as the tenant's only super_admin linked to the first contact", async () => {
    mocks.listWorkspaceSuperAdminIds.mockResolvedValue(["usr_test_1"]);

    const user = await provisionWorkspaceAdmin({
      subdomain: "demo",
      email: "Admin@Demo.COM",
      adminName: "Ali Raza",
      password: "P@ssw0rd123",
      adminPhone: "+92 300 1234567",
      adminGender: "male",
    });

    expect(mocks.createAdminFirstContact).toHaveBeenCalledWith({
      subdomain: "demo",
      name: "Ali Raza",
      email: "Admin@Demo.COM",
      phone: "+92 300 1234567",
      gender: "male",
    });
    expect(mocks.createUser).toHaveBeenCalledWith(
      "Admin@Demo.COM",
      "Ali Raza",
      "P@ssw0rd123",
      "super_admin",
      "demo",
      expect.objectContaining({
        mustChangePassword: true,
        contactId: "ctc_test_1",
      }),
    );
    expect(user.id).toBe("usr_test_1");
    expect(user.role).toBe("super_admin");
  });

  it("fails closed when another super_admin already exists in the tenant", async () => {
    mocks.listWorkspaceSuperAdminIds.mockResolvedValue(["usr_test_1", "usr_intruder"]);

    await expect(
      provisionWorkspaceAdmin({
        subdomain: "demo",
        email: "admin@demo.com",
        adminName: "Ali Raza",
        password: "P@ssw0rd123",
      }),
    ).rejects.toThrow(/super-admin invariant violated/);
  });

  it("fails closed when the provisioned admin is not the tenant's super_admin", async () => {
    mocks.listWorkspaceSuperAdminIds.mockResolvedValue(["usr_intruder"]);

    await expect(
      provisionWorkspaceAdmin({
        subdomain: "demo",
        email: "admin@demo.com",
        adminName: "Ali Raza",
        password: "P@ssw0rd123",
      }),
    ).rejects.toThrow(/super-admin invariant violated/);
  });
});
