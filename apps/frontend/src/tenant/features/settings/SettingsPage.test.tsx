import React, { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import Settings from "./SettingsPage";

const { setTabMock } = vi.hoisted(() => ({ setTabMock: vi.fn() }));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: (_permission: string) => true }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

vi.mock("@/hooks/usePersistedTabState", () => ({
  usePersistedTabState: (_key: string, defaultTab: string) => [defaultTab, setTabMock],
  identityTabNormalizer: (value: string) => value,
}));

vi.mock("@/lib/contexts/SettingsBrandingDraftContext", () => ({
  SettingsBrandingDraftProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSettingsBrandingDraft: () => ({}),
}));

vi.mock("@/lib/contexts/SettingsGlobalDraftContext", () => ({
  SettingsGlobalDraftProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSettingsGlobalDraft: () => ({}),
}));

vi.mock("framer-motion", () => ({
  m: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/config/settingsSectionComponents", () => ({
  SETTINGS_SECTION_COMPONENTS: {
    global: () => <div data-testid="settings-global-content">Global Settings Content</div>,
    modules: () => <div data-testid="settings-modules-content">Modules Content</div>,
    branding: () => <div data-testid="settings-branding-content">Branding Content</div>,
    theme: () => <div data-testid="settings-theme-content">Theme Content</div>,
    backup: () => <div data-testid="settings-backup-content">Backup Content</div>,
    llm: () => <div data-testid="settings-llm-content">AI Assistant Content</div>,
  },
}));

describe("SettingsPage", () => {
  it("renders settings shell and global settings section by default", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/settings"]}>
        <Settings />
      </MemoryRouter>,
    );

    expect(html).toContain("settings.title");
    expect(html).toContain("settings.subtitle");
    expect(html).toContain("settings-global-content");
  });

  it("applies a deep-link tab request to the persisted tab", async () => {
    // Arrange
    setTabMock.mockClear();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    // Act
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/settings?tab=modules"]}>
          <Settings />
        </MemoryRouter>,
      );
    });

    // Assert — the `?tab=modules` deep link selects the Modules section.
    expect(setTabMock).toHaveBeenCalledWith("modules");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
