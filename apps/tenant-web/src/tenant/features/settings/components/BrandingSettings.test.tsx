import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BRANDING_SETTINGS } from "@mms/contracts";
import BrandingSettings from "./BrandingSettings";

let mockCanWrite = true;
let mockIsDirty = false;

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: (_perm: string) => mockCanWrite }),
}));

const mockUpd = vi.fn();
const mockHandleSaveIdentity = vi.fn();
const mockHandleDiscardIdentity = vi.fn();

vi.mock("@/lib/contexts/SettingsBrandingDraftContext", () => ({
  useSettingsBrandingDraft: () => ({
    data: {
      ...DEFAULT_BRANDING_SETTINGS,
      addressLine1: "123 Main St",
      city: "Metropolis",
      socialLinks: [],
    },
    isIdentityDirty: mockIsDirty,
    saved: false,
    saving: false,
    upd: mockUpd,
    handleSaveIdentity: mockHandleSaveIdentity,
    handleDiscardIdentity: mockHandleDiscardIdentity,
  }),
}));

vi.mock("@/components/branding/BrandingIdentityPreview", () => ({
  default: () => <div data-testid="identity-preview">IdentityPreview</div>,
}));

vi.mock("@/components/branding/BrandingIdentitySections", () => ({
  BrandingSettingsProfileSection: () => <div data-testid="profile-section">ProfileSection</div>,
  BrandingSettingsContactSection: () => <div data-testid="contact-section">ContactSection</div>,
}));

vi.mock("@/components/branding/BrandingShared", () => ({
  SocialLinksEditor: () => <div data-testid="social-editor">SocialLinksEditor</div>,
}));

function setInputValue(input: HTMLInputElement, value: string): void {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  nativeInputValueSetter?.call(input, value);
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("BrandingSettings", () => {
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

  it("renders admin-only notice when user lacks write permission", async () => {
    mockCanWrite = false;
    await act(async () => {
      root.render(<BrandingSettings />);
    });
    expect(container.textContent).toContain("settings.adminOnly");
  });

  it("renders branding settings form when user has write permission", async () => {
    mockCanWrite = true;
    mockIsDirty = false;
    await act(async () => {
      root.render(<BrandingSettings />);
    });
    expect(container.textContent).toContain("branding.previewTitle");
    expect(container.textContent).toContain("branding.addressTitle");

    const input = container.querySelector("#addressLine1") as HTMLInputElement;
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input.value).toBe("123 Main St");
  });

  it("triggers upd when address field changes", async () => {
    mockCanWrite = true;
    mockIsDirty = true;
    await act(async () => {
      root.render(<BrandingSettings />);
    });

    const input = container.querySelector("#addressLine1") as HTMLInputElement;
    expect(input).toBeInstanceOf(HTMLInputElement);

    await act(async () => {
      setInputValue(input, "456 Elm St");
    });

    expect(mockUpd).toHaveBeenCalledWith("addressLine1", "456 Elm St");
  });
});
