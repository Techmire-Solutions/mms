import { describe, expect, it } from "vitest";
import { getVisiblePlatformNavItems, PLATFORM_NAV_ITEMS } from "./platformNav";
import type { PlatformPermissionsState } from "@/platform/hooks/usePlatformPermissions";

function perms(overrides: Partial<PlatformPermissionsState> = {}): PlatformPermissionsState {
  return {
    platformUser: null,
    isPlatformAuthenticated: true,
    isSuperUser: false,
    canWorkspaces: false,
    canOnboard: false,
    canSettings: false,
    canAdmins: false,
    canSystem: false,
    can: () => false,
    ...overrides,
  };
}

describe("platformNav", () => {
  it("shows settings for settings capability without system", () => {
    const visible = getVisiblePlatformNavItems(perms({ canSettings: true }));
    expect(visible.map((item) => item.id)).toContain("settings");
    expect(visible.map((item) => item.id)).not.toContain("system");
  });

  it("hides settings when neither settings nor system are granted", () => {
    const visible = getVisiblePlatformNavItems(perms({ canWorkspaces: true }));
    expect(visible.map((item) => item.id)).not.toContain("settings");
  });

  it("keeps settings nav isVisible bound to canSettings", () => {
    const settingsItem = PLATFORM_NAV_ITEMS.find((item) => item.id === "settings");
    expect(settingsItem?.isVisible(perms({ canSettings: true }))).toBe(true);
    expect(settingsItem?.isVisible(perms({ canSystem: true, canSettings: false }))).toBe(false);
  });
});
