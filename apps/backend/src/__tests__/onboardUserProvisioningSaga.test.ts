import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  unblockTenant: vi.fn(),
  seedTenantDefaults: vi.fn(),
  provisionWorkspaceAdmin: vi.fn(),
  findUserByLoginEmailAndWorkspace: vi.fn(),
  upsertWorkspaceBranding: vi.fn(),
  upsertContactModulePreferences: vi.fn(),
  sendTenantWelcomeEmail: vi.fn(),
}));

vi.mock("../services/workspaceService.js", () => ({
  createWorkspace: mocks.createWorkspace,
  deleteWorkspace: mocks.deleteWorkspace,
  assertWorkspaceActive: vi.fn(),
  upsertWorkspaceBranding: mocks.upsertWorkspaceBranding,
  syncWorkspaceFromBranding: vi.fn(),
  getWorkspaceBySubdomain: vi.fn(),
}));

vi.mock("../services/auth/userService.js", () => ({
  findUserByLoginEmailAndWorkspace: mocks.findUserByLoginEmailAndWorkspace,
  validateCredentials: vi.fn(),
}));

vi.mock("../services/auth/userServiceShared.js", () => ({
  toPublicUser: (user: unknown) => user,
}));

vi.mock("../services/tenantSeedService.js", () => ({
  seedTenantDefaults: mocks.seedTenantDefaults,
}));

vi.mock("../services/workspaceAdminProvisioningService.js", () => ({
  provisionWorkspaceAdmin: mocks.provisionWorkspaceAdmin,
}));

vi.mock("../services/globalSettingsService.js", () => ({
  loadGlobalSettings: vi.fn().mockResolvedValue({}),
  saveGlobalSettings: vi.fn().mockResolvedValue(undefined),
  getJwtExpiresIn: vi.fn().mockReturnValue("15m"),
}));

vi.mock("../lib/tenantContext.js", () => ({
  runWithTenant: (_tenant: string, callback: () => Promise<unknown>) => callback(),
  getRequestTenant: () => "demo",
}));

vi.mock("../db/repositories/contactModulePreferencesRepository.js", () => ({
  upsertContactModulePreferences: mocks.upsertContactModulePreferences,
}));

vi.mock("../services/authSessionService.js", () => ({
  unblockTenant: mocks.unblockTenant,
  blockTenant: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/auth/tenantPasswordOtpDispatch.js", () => ({
  sendTenantWelcomeEmail: mocks.sendTenantWelcomeEmail,
}));

vi.mock("../services/platform/platformEmailConfig.js", () => ({
  resolvePlatformAppOrigin: () => "http://localhost:5173",
}));

vi.mock("../services/auth/twoFactorService.js", () => ({
  createTwoFactorChallenge: vi.fn(),
  issueRefreshToken: vi.fn(),
}));

vi.mock("../services/auth/authCookieService.js", () => ({
  setAuthCookies: vi.fn(),
}));

vi.mock("../services/platform/platformCookieService.js", () => ({
  clearPlatformAccessCookie: vi.fn(),
}));

import { onboardUser } from "../services/auth/authService.js";
import { setPlatformSettingsCache } from "../services/platform/platformSettingsService.js";
import { DEFAULT_PLATFORM_SETTINGS } from "@mms/shared";

const workspace = { id: "ws_1", subdomain: "demo", madrasaName: "Demo Madrasa", enabled: true };

describe("onboardUser provisioning saga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPlatformSettingsCache({ ...DEFAULT_PLATFORM_SETTINGS, disabledModules: [] });
    mocks.createWorkspace.mockResolvedValue(workspace);
    mocks.deleteWorkspace.mockResolvedValue(workspace);
    mocks.unblockTenant.mockResolvedValue(undefined);
    mocks.seedTenantDefaults.mockResolvedValue(undefined);
    mocks.upsertWorkspaceBranding.mockResolvedValue(undefined);
    mocks.upsertContactModulePreferences.mockResolvedValue(undefined);
    mocks.sendTenantWelcomeEmail.mockReset().mockResolvedValue({ sent: true });
  });

  it("purges the partial workspace when admin provisioning fails, so a retry is possible", async () => {
    mocks.provisionWorkspaceAdmin.mockRejectedValue(
      new Error("Tenant provisioning failed: super-admin invariant violated"),
    );

    await expect(
      onboardUser({
        subdomain: "demo",
        madrasaName: "Demo Madrasa",
        adminName: "Ali Raza",
        email: "admin@demo.com",
        adminGender: "male",
        adminPasswordMode: "temporary",
        password: "P@ssw0rd123",
      }),
    ).rejects.toThrow(/super-admin invariant violated/);

    expect(mocks.deleteWorkspace).toHaveBeenCalledWith("demo");
  });

  it("rejects a platform-disabled module before creating a workspace", async () => {
    setPlatformSettingsCache({ ...DEFAULT_PLATFORM_SETTINGS, disabledModules: ["finance"] });

    await expect(
      onboardUser({
        subdomain: "demo",
        madrasaName: "Demo Madrasa",
        adminName: "Ali Raza",
        email: "admin@demo.com",
        adminGender: "male",
        adminPasswordMode: "temporary",
        password: "P@ssw0rd123",
        modules: ["finance"],
      }),
    ).rejects.toThrow(/disabled platform-wide/);

    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });

  it("applies platform module defaults when the caller sends no module list", async () => {
    setPlatformSettingsCache({
      ...DEFAULT_PLATFORM_SETTINGS,
      defaultEnabledModules: { tasks: false },
    });
    mocks.provisionWorkspaceAdmin.mockResolvedValue({
      id: "usr_1",
      loginEmail: "admin@demo.com",
      name: "Ali Raza",
      role: "super_admin",
      workspaceSubdomain: "demo",
    });
    mocks.findUserByLoginEmailAndWorkspace.mockResolvedValue({
      id: "usr_1",
      loginEmail: "admin@demo.com",
      name: "Ali Raza",
      role: "super_admin",
      workspaceSubdomain: "demo",
    });

    await onboardUser({
      subdomain: "demo",
      madrasaName: "Demo Madrasa",
      adminName: "Ali Raza",
      email: "admin@demo.com",
      adminGender: "male",
      adminPasswordMode: "temporary",
      password: "P@ssw0rd123",
    });

    expect(mocks.createWorkspace).toHaveBeenCalled();
  });

  it("keeps the workspace and returns the provisioned admin on success", async () => {
    mocks.provisionWorkspaceAdmin.mockResolvedValue({
      id: "usr_1",
      loginEmail: "admin@demo.com",
      name: "Ali Raza",
      role: "super_admin",
      workspaceSubdomain: "demo",
    });
    mocks.findUserByLoginEmailAndWorkspace.mockResolvedValue({
      id: "usr_1",
      loginEmail: "admin@demo.com",
      name: "Ali Raza",
      role: "super_admin",
      workspaceSubdomain: "demo",
    });

    const result = await onboardUser({
      subdomain: "demo",
      madrasaName: "Demo Madrasa",
      adminName: "Ali Raza",
      email: "admin@demo.com",
      adminGender: "male",
      adminPasswordMode: "temporary",
      password: "P@ssw0rd123",
    });

    // Console-database record: the collected admin identity is handed to the
    // workspace insert together with the madrasa name.
    expect(mocks.createWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        subdomain: "demo",
        madrasaName: "Demo Madrasa",
        provisionedAdmin: { name: "Ali Raza", email: "admin@demo.com", gender: "male" },
      }),
    );
    expect(mocks.provisionWorkspaceAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ adminGender: "male", subdomain: "demo" }),
    );

    expect(result.workspace.subdomain).toBe("demo");
    expect(result.user.id).toBe("usr_1");
    expect(mocks.deleteWorkspace).not.toHaveBeenCalled();
  });

  it("email mode dispatches the activation email and reports whether it was sent", async () => {
    mocks.provisionWorkspaceAdmin.mockResolvedValue({ id: "usr_1", role: "super_admin" });
    mocks.findUserByLoginEmailAndWorkspace.mockResolvedValue({
      id: "usr_1",
      loginEmail: "admin@demo.com",
      role: "super_admin",
    });

    const result = await onboardUser({
      subdomain: "demo",
      madrasaName: "Demo Madrasa",
      adminName: "Ali Raza",
      email: "admin@demo.com",
      adminGender: "male",
      adminPasswordMode: "email",
    });

    // No operator password is forwarded; the generated random one is never emailed.
    const provisionArgs = mocks.provisionWorkspaceAdmin.mock.calls[0]![0] as {
      password: string;
      passwordPolicyChecked?: boolean;
    };
    expect(provisionArgs.passwordPolicyChecked).toBe(true);
    expect(mocks.sendTenantWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceSubdomain: "demo", email: "admin@demo.com" }),
    );
    expect(result.inviteEmailSent).toBe(true);
    expect(result.inviteEmailError).toBeUndefined();
  });

  it("surfaces a failed activation email without failing the tenant creation", async () => {
    mocks.provisionWorkspaceAdmin.mockResolvedValue({ id: "usr_1", role: "super_admin" });
    mocks.findUserByLoginEmailAndWorkspace.mockResolvedValue({
      id: "usr_1",
      loginEmail: "admin@demo.com",
      role: "super_admin",
    });
    mocks.sendTenantWelcomeEmail.mockResolvedValue({
      sent: false,
      error: "No outgoing mail server is configured",
    });

    const result = await onboardUser({
      subdomain: "demo",
      madrasaName: "Demo Madrasa",
      adminName: "Ali Raza",
      email: "admin@demo.com",
      adminGender: "male",
      adminPasswordMode: "email",
    });

    expect(result.workspace.subdomain).toBe("demo");
    expect(result.inviteEmailSent).toBe(false);
    expect(result.inviteEmailError).toContain("No outgoing mail server");
  });

  it("temporary mode never sends an activation email", async () => {
    mocks.provisionWorkspaceAdmin.mockResolvedValue({ id: "usr_1", role: "super_admin" });
    mocks.findUserByLoginEmailAndWorkspace.mockResolvedValue({
      id: "usr_1",
      loginEmail: "admin@demo.com",
      role: "super_admin",
    });

    await onboardUser({
      subdomain: "demo",
      madrasaName: "Demo Madrasa",
      adminName: "Ali Raza",
      email: "admin@demo.com",
      adminGender: "male",
      adminPasswordMode: "temporary",
      password: "TempPass123!",
    });

    expect(mocks.sendTenantWelcomeEmail).not.toHaveBeenCalled();
    expect(mocks.provisionWorkspaceAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ password: "TempPass123!", passwordPolicyChecked: false }),
    );
  });
});
