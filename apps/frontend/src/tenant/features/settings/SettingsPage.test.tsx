import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import Settings from "./SettingsPage";

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
  usePersistedTabState: (_key: string, defaultTab: string) => [defaultTab, vi.fn()],
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
});
