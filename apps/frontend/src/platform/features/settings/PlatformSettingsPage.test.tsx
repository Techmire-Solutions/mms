import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import PlatformSettingsPage from "@/platform/features/settings/PlatformSettingsPage";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

vi.mock("@/platform/hooks/usePlatformPermissions", () => ({
  usePlatformPermissions: () => ({
    canSettings: true,
    canSystem: true,
    canOnboard: true,
    isSuperUser: true,
    platformUser: { id: "admin-1", name: "Zaid" },
  }),
}));

vi.mock("@/platform/features/settings/hooks/usePlatformSettings", () => ({
  usePlatformSettingsQuery: () => ({
    data: {
      id: "global",
      syncTlsOnCreate: true,
      tlsExtraSans: "",
      certbotEmail: "admin@example.com",
    },
    isLoading: false,
    isError: false,
  }),
  useUpdatePlatformSettings: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe("PlatformSettingsPage", () => {
  it("renders the six parity sections", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformSettingsPage />
      </MemoryRouter>,
    );

    expect(html).toContain("platform.settingsPageTitle");
    expect(html).toContain("platform.settingsTabGlobal");
    expect(html).toContain("platform.settingsTabBranding");
    expect(html).toContain("platform.settingsTabTheme");
    expect(html).toContain("platform.settingsTabModules");
    expect(html).toContain("platform.settingsTabLlm");
    expect(html).toContain("platform.settingsTabBackup");
  });

  it.each([
    ["notifications", "platform.settingsTabGlobal"],
    ["security", "platform.settingsTabGlobal"],
    ["branding", "platform.settingsTabBranding"],
    ["modules", "platform.settingsTabModules"],
  ])("resolves ?section=%s to the %s tab", (section, activeLabel) => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={[`/platform/settings?section=${section}`]}>
        <PlatformSettingsPage />
      </MemoryRouter>,
    );
    expect(html).toContain(activeLabel);
    expect(html).toContain('aria-current="page"');
  });
});
