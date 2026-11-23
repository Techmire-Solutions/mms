import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GLOBAL_SETTINGS } from "@mms/shared";
import GlobalSettings from "./GlobalSettings";

let mockCanWrite = true;
let mockIsDirty = false;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: (_perm: string) => mockCanWrite }),
}));

const mockUpd = vi.fn();
const mockHandleSaveGlobal = vi.fn();
const mockHandleDiscardGlobal = vi.fn();

vi.mock("@/lib/contexts/SettingsGlobalDraftContext", () => ({
  useSettingsGlobalDraft: () => ({
    data: {
      ...DEFAULT_GLOBAL_SETTINGS,
      language: "en",
      timezone: "UTC",
      dateFormat: "DD/MM/YYYY",
    },
    isGlobalDirty: mockIsDirty,
    saved: false,
    saving: false,
    upd: mockUpd,
    handleSaveGlobal: mockHandleSaveGlobal,
    handleDiscardGlobal: mockHandleDiscardGlobal,
  }),
}));

vi.mock("@/components/app/DateFormatSelect", () => ({
  default: () => <div data-testid="date-format-select">DateFormatSelect</div>,
}));

vi.mock("@/components/app/TimezoneSelect", () => ({
  default: () => <div data-testid="timezone-select">TimezoneSelect</div>,
}));

vi.mock("@/tenant/features/settings/components/GlobalSettingsSecuritySection", () => ({
  GlobalSettingsSecuritySection: () => <div data-testid="security-section">SecuritySection</div>,
}));

describe("GlobalSettings", () => {
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

  it("renders regional section and admin notice when user lacks write permission", async () => {
    mockCanWrite = false;
    await act(async () => {
      root.render(<GlobalSettings />);
    });
    expect(container.textContent).toContain("global.regionalTitle");
    expect(container.textContent).toContain("global.notificationsSecurityAdminOnlyTitle");
  });

  it("renders security section and save actions when user has write permission", async () => {
    mockCanWrite = true;
    mockIsDirty = false;
    await act(async () => {
      root.render(<GlobalSettings />);
    });
    expect(container.textContent).toContain("global.regionalTitle");
    expect(container.querySelector('[data-testid="security-section"]')).toBeInstanceOf(
      HTMLDivElement,
    );
    expect(container.textContent).toContain("global.saveSettings");
  });
});
