import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLATFORM_BRANDING,
  platformBrandingUpdateSchema,
} from "../branding/platformBrandingTypes.js";
import {
  formatPlatformFooterDefault,
  isPlatformBrandingFieldsDirty,
  mergePlatformBranding,
  mergePlatformBrandingOverBaseline,
  pickPlatformBrandingFields,
  platformBrandingToBrandingSettings,
  toPublicPlatformBranding,
} from "../branding/platformBrandingUtils.js";

describe("platform branding", () => {
  it("merges a patch with defaults and normalizes values", () => {
    const merged = mergePlatformBranding({
      productName: "  Acme Academy Cloud ",
      consoleTitle: " Admin ",
      primaryColor: "#ABCDEF",
      secondaryColor: "not-a-colour",
      cornerStyle: "soft",
      socialLinks: [{ platform: "LinkedIn", url: " https://linkedin.com/acme " }],
    });

    expect(merged.productName).toBe("Acme Academy Cloud");
    expect(merged.consoleTitle).toBe("Admin");
    expect(merged.primaryColor).toBe("#abcdef");
    expect(merged.secondaryColor).toBe(DEFAULT_PLATFORM_BRANDING.secondaryColor);
    expect(merged.cornerStyle).toBe("soft");
    expect(merged.socialLinks).toEqual([
      { platform: "LinkedIn", url: "https://linkedin.com/acme" },
    ]);
  });

  it("falls back to defaults for an empty record", () => {
    expect(mergePlatformBranding(null)).toMatchObject({
      productName: "",
      consoleTitle: "",
      primaryColor: DEFAULT_PLATFORM_BRANDING.primaryColor,
      cornerStyle: DEFAULT_PLATFORM_BRANDING.cornerStyle,
    });
  });

  it("projects only public fields", () => {
    const publicBranding = toPublicPlatformBranding({
      ...DEFAULT_PLATFORM_BRANDING,
      productName: "Acme",
      email: "secret@acme.test",
      legalName: "Acme LLC",
    });
    expect(publicBranding.productName).toBe("Acme");
    expect(publicBranding).not.toHaveProperty("email");
    expect(publicBranding).not.toHaveProperty("legalName");
  });

  it("adapts to the shared BrandingSettings shape", () => {
    const branding = platformBrandingToBrandingSettings({
      ...DEFAULT_PLATFORM_BRANDING,
      productName: "Acme",
    });
    expect(branding.madrasaName).toBe("Acme");
    expect(branding.primaryColor).toBe(DEFAULT_PLATFORM_BRANDING.primaryColor);
  });

  it("computes dirty tracked fields and overlays a baseline", () => {
    const baseline = mergePlatformBranding({ productName: "A" });
    const draft = { ...baseline, productName: "B" };
    expect(isPlatformBrandingFieldsDirty(draft, baseline, ["productName"])).toBe(true);
    expect(isPlatformBrandingFieldsDirty(draft, baseline, ["tagline"])).toBe(false);
    expect(
      mergePlatformBrandingOverBaseline(baseline, { productName: "B" }, ["productName"])
        .productName,
    ).toBe("B");
    expect(pickPlatformBrandingFields(baseline, ["productName"]).productName).toBe("A");
  });

  it("formats a platform footer with the product name", () => {
    expect(formatPlatformFooterDefault("Acme", "en")).toContain("Acme");
  });

  describe("update schema", () => {
    it("accepts valid partials", () => {
      expect(
        platformBrandingUpdateSchema.safeParse({
          productName: "Acme",
          primaryColor: "#123456",
          cornerStyle: "soft",
          logoUrl: "/uploads/branding/logo.webp",
          socialLinks: [{ platform: "LinkedIn", url: "https://linkedin.com/acme" }],
        }).success,
      ).toBe(true);
    });

    it("rejects invalid colours, asset URLs, social platforms, and unknown keys", () => {
      expect(platformBrandingUpdateSchema.safeParse({ primaryColor: "red" }).success).toBe(false);
      expect(
        platformBrandingUpdateSchema.safeParse({ logoUrl: "javascript:alert(1)" }).success,
      ).toBe(false);
      expect(
        platformBrandingUpdateSchema.safeParse({
          socialLinks: [{ platform: "Myspace", url: "https://myspace.com/acme" }],
        }).success,
      ).toBe(false);
      expect(platformBrandingUpdateSchema.safeParse({ unexpected: true }).success).toBe(false);
    });
  });
});
