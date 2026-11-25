import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPlatformBrandingPreview,
  getEffectivePlatformThemeMode,
  getPlatformBrandingAsBrandingSettings,
  getPlatformBrandingSettings,
  getPlatformProductName,
  previewPlatformBranding,
  setPlatformBrandingState,
  subscribePlatformBranding,
} from "@/lib/branding/platformBrandingStore";
import { DEFAULT_PLATFORM_BRANDING } from "@mms/contracts";

vi.mock("@/lib/config/tenantConfig", () => ({
  isTenantHost: () => false,
}));

describe("platformBrandingStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearPlatformBrandingPreview();
    setPlatformBrandingState({
      branding: DEFAULT_PLATFORM_BRANDING,
      themeMode: "system",
      timezone: "UTC",
      dateFormat: "DD/MM/YYYY",
    });
  });

  it("persists and exposes saved branding/theme/regional state", () => {
    setPlatformBrandingState({
      branding: { ...DEFAULT_PLATFORM_BRANDING, productName: "Acme Cloud" },
      themeMode: "dark",
      timezone: "Asia/Karachi",
      dateFormat: "YYYY-MM-DD",
    });

    expect(getPlatformProductName()).toBe("Acme Cloud");
    expect(getPlatformBrandingAsBrandingSettings().madrasaName).toBe("Acme Cloud");
    expect(getEffectivePlatformThemeMode()).toBe("dark");
    const stored = JSON.parse(window.localStorage.getItem("mms_platform_branding") ?? "{}");
    expect(stored.themeMode).toBe("dark");
    expect(stored.timezone).toBe("Asia/Karachi");
  });

  it("applies an unsaved preview over the saved branding", () => {
    setPlatformBrandingState({
      branding: { ...DEFAULT_PLATFORM_BRANDING, productName: "Saved" },
      themeMode: "light",
      timezone: "UTC",
      dateFormat: "DD/MM/YYYY",
    });

    previewPlatformBranding({ productName: "Preview", primaryColor: "#123456" }, "dark");
    expect(getPlatformBrandingSettings().productName).toBe("Preview");
    expect(getPlatformBrandingSettings().primaryColor).toBe("#123456");
    expect(getEffectivePlatformThemeMode()).toBe("dark");

    clearPlatformBrandingPreview();
    expect(getPlatformBrandingSettings().productName).toBe("Saved");
    expect(getEffectivePlatformThemeMode()).toBe("light");
  });

  it("notifies subscribers on state changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePlatformBranding(listener);
    setPlatformBrandingState({
      branding: { ...DEFAULT_PLATFORM_BRANDING, productName: "Acme" },
      themeMode: "system",
      timezone: "UTC",
      dateFormat: "DD/MM/YYYY",
    });
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});
