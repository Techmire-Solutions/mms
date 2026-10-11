import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetRequestTenant = vi.fn();
const mockGetUserModulePreferencesByWorkspace = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
}));

vi.mock("../db/repositories/userModulePreferencesRepository.js", () => ({
  getUserModulePreferencesByWorkspace: (...args: unknown[]) =>
    mockGetUserModulePreferencesByWorkspace(...args),
}));

describe("getTenantUsersSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns defaults when tenant context is missing", async () => {
    mockGetRequestTenant.mockReturnValue(undefined);
    const { getTenantUsersSettings } = await import("../services/users/usersSettingsService.js");
    const settings = await getTenantUsersSettings();
    expect(settings.requireEmailVerification).toBe(true);
    expect(mockGetUserModulePreferencesByWorkspace).not.toHaveBeenCalled();
  });

  it("reads requireEmailVerification from typed user_module_preferences", async () => {
    mockGetRequestTenant.mockReturnValue("demo");
    mockGetUserModulePreferencesByWorkspace.mockResolvedValue({
      allowSelfRegistration: false,
      requireEmailVerification: true,
      defaultViewLayout: "table",
      workspaceRoles: [],
    });
    vi.resetModules();
    const { getTenantUsersSettings } = await import("../services/users/usersSettingsService.js");
    const settings = await getTenantUsersSettings();
    expect(mockGetUserModulePreferencesByWorkspace).toHaveBeenCalledWith("demo");
    expect(settings.requireEmailVerification).toBe(true);
  });
});
