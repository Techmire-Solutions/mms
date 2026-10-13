import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UsersSetupTier } from "./UsersSetupTier";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/ModuleTierMotion", () => ({
  ModuleTierMotion: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="module-tier-motion">{children}</div>
  ),
}));

vi.mock("@/components/app/SubTabBar", () => ({
  SubTabBar: () => <div data-testid="sub-tab-bar">SubTabBar</div>,
}));

vi.mock("@/components/app/SetupReadOnlyMessage", () => ({
  SetupReadOnlyMessage: ({ title }: { title: string }) => (
    <div data-testid="read-only">{title}</div>
  ),
}));

vi.mock("@/tenant/features/users/hooks/useUsersSetupPanelState", () => ({
  useUsersSetupPanelState: () => ({
    settingsDraft: { allowSelfRegistration: false, requireEmailVerification: false },
    saved: true,
    saving: false,
    isPrefsDirty: false,
    dirtyRef: { current: { prefs: false } },
    upd: vi.fn(),
    handleSave: vi.fn(),
    discardSetupDrafts: vi.fn(),
  }),
}));

vi.mock("./RolesPermissions", () => ({
  default: () => <div data-testid="roles-permissions">Roles & Permissions</div>,
  RolesPermissions: () => <div data-testid="roles-permissions">Roles & Permissions</div>,
}));

vi.mock("./UsersSettingsPanel", () => ({
  default: () => <div data-testid="users-settings-panel">Users Settings Panel</div>,
  UsersSettingsPanel: () => <div data-testid="users-settings-panel">Users Settings Panel</div>,
}));

describe("UsersSetupTier Component", () => {
  const defaultProps = {
    tabs: [
      { id: "permissions", label: "Permissions" },
      { id: "preferences", label: "Preferences" },
    ],
    activeTab: "permissions",
    canEditSetup: true,
    onTabChange: vi.fn(),
  };

  it("renders tier motion and subtab bar when canEditSetup is true", () => {
    const html = renderToStaticMarkup(<UsersSetupTier {...defaultProps} />);
    expect(html).toContain("module-tier-motion");
    expect(html).toContain("SubTabBar");
  });

  it("renders read-only message when canEditSetup is false", () => {
    const html = renderToStaticMarkup(<UsersSetupTier {...defaultProps} canEditSetup={false} />);
    expect(html).toContain("users.setup.readOnly");
  });
});
