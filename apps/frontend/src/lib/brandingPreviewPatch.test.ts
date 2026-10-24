import { describe, expect, it } from "vitest";
import {
  BRANDING_IDENTITY_FIELD_KEYS,
  BRANDING_THEME_FIELD_KEYS,
  DEFAULT_BRANDING_SETTINGS,
  mergeBrandingSettings,
} from "@mms/shared";
import { buildBrandingPreviewPatch } from "@/lib/brandingPreviewPatch";

describe("buildBrandingPreviewPatch", () => {
  it("returns full merged record when trackKeys is omitted", () => {
    const merged = mergeBrandingSettings({
      ...DEFAULT_BRANDING_SETTINGS,
      madrasaName: "Test Madrasa",
    });
    expect(buildBrandingPreviewPatch(merged)).toEqual(merged);
  });

  it("includes theme colours in identity-only preview patches", () => {
    const merged = mergeBrandingSettings({
      ...DEFAULT_BRANDING_SETTINGS,
      madrasaName: "Test Madrasa",
      primaryColor: "#112233",
      secondaryColor: "#445566",
      cornerStyle: "sharp",
    });
    const patch = buildBrandingPreviewPatch(merged, BRANDING_IDENTITY_FIELD_KEYS);
    expect(patch.madrasaName).toBe("Test Madrasa");
    expect(patch.primaryColor).toBe("#112233");
    expect(patch.secondaryColor).toBe("#445566");
    expect(patch.cornerStyle).toBe("sharp");
    expect(patch.footerText).toBeUndefined();
  });

  it("scopes theme preview to theme field keys only", () => {
    const merged = mergeBrandingSettings({
      ...DEFAULT_BRANDING_SETTINGS,
      madrasaName: "Changed name",
      primaryColor: "#aabbcc",
      footerText: "Custom footer",
    });
    const patch = buildBrandingPreviewPatch(merged, BRANDING_THEME_FIELD_KEYS);
    expect(patch.primaryColor).toBe("#aabbcc");
    expect(patch.footerText).toBe("Custom footer");
    expect(patch.madrasaName).toBeUndefined();
  });
});
