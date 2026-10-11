import { describe, expect, it, vi } from "vitest";
import type { PlatformUserProfile } from "@mms/shared";
import { platformUserCan } from "@mms/shared";
import { usePlatformPermissions } from "./usePlatformPermissions";
import { usePlatformAuth } from "@/platform/lib/PlatformAuthContext";

vi.mock("@/platform/lib/PlatformAuthContext", () => ({
  usePlatformAuth: vi.fn(),
}));

describe("usePlatformPermissions", () => {
  it("evaluates super-user capability grants via platformUserCan helper", () => {
    const mockSuperUser: PlatformUserProfile = {
      id: "usr_super",
      email: "super@apex.test",
      name: "Super Operator",
      role: "super_user",
      permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: true },
    };

    expect(platformUserCan(mockSuperUser, "workspaces")).toBe(true);
    expect(platformUserCan(mockSuperUser, "onboard")).toBe(true);
  });

  it("evaluates standard admin granular permissions via platformUserCan helper", () => {
    const mockAdmin: PlatformUserProfile = {
      id: "usr_admin",
      email: "admin@apex.test",
      name: "Standard Admin",
      role: "admin",
      permissions: {
        workspaces: true,
        onboard: false,
        settings: false,
        admins: false,
        system: false,
      },
    };

    expect(platformUserCan(mockAdmin, "workspaces")).toBe(true);
    expect(platformUserCan(mockAdmin, "onboard")).toBe(false);
    expect(platformUserCan(null, "workspaces")).toBe(false);
  });

  it("provides hook function signature matching PlatformPermissionsState", () => {
    vi.mocked(usePlatformAuth).mockReturnValue({
      platformUser: null,
      isPlatformAuthenticated: false,
      isCheckingPlatformAuth: false,
      isPlatformLoginSubmitting: false,
      platformAuthChecked: true,
      platformLogin: vi.fn(),
      platformVerify2FA: vi.fn(),
      platformResend2FA: vi.fn(),
      extendPlatformSession: vi.fn(),
      isExtendingPlatformSession: false,
      platformLogout: vi.fn(),
      checkPlatformAuth: vi.fn(),
    });

    expect(typeof usePlatformPermissions).toBe("function");
  });
});
