import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BRANDING_SETTINGS, mergeBrandingSettings } from "@mms/shared";
import ThemeSettings from "./ThemeSettings";

let mockCanWrite = true;
let mockIsDirty = false;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/lib/contexts/SettingsTabContext", () => ({
  useSettingsTab: () => ({ setActiveTab: vi.fn() }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: (_perm: string) => mockCanWrite }),
}));

vi.mock("@/tenant/features/settings/hooks/useThemeSettingsDraft", () => ({
  useThemeSettingsDraft: () => ({
    data: mergeBrandingSettings(DEFAULT_BRANDING_SETTINGS),
    displayMode: "system",
    setDisplayMode: vi.fn(),
    previewMode: "light",
    displayModeSummary: "Matches device preferences",
    isDirty: mockIsDirty,
    saving: false,
    saved: false,
    upd: vi.fn(),
    handleSave: vi.fn(),
    handleResetToDefaults: vi.fn(),
    handleDiscardChanges: vi.fn(),
    defaultFooterPreview: "Default Footer",
  }),
}));

vi.mock("@/hooks/useApplyLogoColors", () => ({
  useApplyLogoColors: () => ({
    applying: false,
    effectiveLogoUrl: "",
    isSample: false,
    extractedPalette: [],
    proportions: {},
    bestPair: null,
    apply: vi.fn(),
    applyBestPair: vi.fn(),
    setSampleLogo: vi.fn(),
    clearSampleLogo: vi.fn(),
  }),
}));

describe("ThemeSettings", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockCanWrite = true;
    mockIsDirty = false;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("renders admin only notice when user lacks write permission", async () => {
    mockCanWrite = false;
    await act(async () => {
      root.render(<ThemeSettings />);
    });
    expect(container.textContent).toContain("settings.adminOnly");
  });

  it("renders theme settings panel when user has write permission", async () => {
    mockCanWrite = true;
    mockIsDirty = false;
    await act(async () => {
      root.render(<ThemeSettings />);
    });
    expect(container.textContent).toContain("theme.save");
    expect(container.textContent).toContain("theme.resetDefaults");
  });

  it("renders discard changes button when dirty", async () => {
    mockCanWrite = true;
    mockIsDirty = true;
    await act(async () => {
      root.render(<ThemeSettings />);
    });
    expect(container.textContent).toContain("theme.discardChanges");
  });
});
