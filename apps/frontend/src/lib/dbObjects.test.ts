import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  mergeGlobalSettingsPreview,
  clearGlobalSettingsPreviewOverlay,
  getEffectiveGlobalSettings,
  mergeBrandingSettingsPreview,
  clearBrandingSettingsPreviewOverlay,
  getEffectiveBrandingSettings,
} from "@/lib/dbObjects";
import { getObject } from "@/lib/dbObjectStorage";

vi.mock("@/lib/dbObjectStorage", () => ({
  getObject: vi.fn(),
  readObjectLocal: vi.fn(),
  writeObjectLocal: vi.fn(),
}));

const mockedGetObject = vi.mocked(getObject);

describe("dbObjects preview overlays", () => {
  beforeEach(() => {
    mockedGetObject.mockReset();
    clearGlobalSettingsPreviewOverlay();
    clearBrandingSettingsPreviewOverlay();
  });

  it("getEffectiveGlobalSettings merges a preview patch over persisted settings", () => {
    mockedGetObject.mockReturnValue({ dateFormat: "DD/MM/YYYY", timezone: "UTC", language: "en" });
    mergeGlobalSettingsPreview({ timezone: "Asia/Karachi" });
    const effective = getEffectiveGlobalSettings();
    expect(effective.timezone).toBe("Asia/Karachi");
    expect(effective.dateFormat).toBe("DD/MM/YYYY");
  });

  it("clearGlobalSettingsPreviewOverlay drops the preview", () => {
    mockedGetObject.mockReturnValue({ dateFormat: "DD/MM/YYYY", timezone: "UTC", language: "en" });
    mergeGlobalSettingsPreview({ timezone: "Asia/Karachi" });
    clearGlobalSettingsPreviewOverlay();
    expect(getEffectiveGlobalSettings().timezone).toBe("UTC");
  });

  it("getEffectiveBrandingSettings merges a branding preview patch", () => {
    mockedGetObject.mockReturnValue({ primaryColor: "#111111", secondaryColor: "#222222" });
    mergeBrandingSettingsPreview({ primaryColor: "#ff0000" });
    const effective = getEffectiveBrandingSettings();
    expect(effective.primaryColor).toBe("#ff0000");
    expect(effective.secondaryColor).toBe("#222222");
  });

  it("clearBrandingSettingsPreviewOverlay drops the branding preview", () => {
    mockedGetObject.mockReturnValue({ primaryColor: "#111111", secondaryColor: "#222222" });
    mergeBrandingSettingsPreview({ primaryColor: "#ff0000" });
    clearBrandingSettingsPreviewOverlay();
    expect(getEffectiveBrandingSettings().primaryColor).toBe("#111111");
  });
});
