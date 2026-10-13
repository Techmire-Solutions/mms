import { describe, expect, it } from "vitest";
import { getContrastRatio, meetsWcagAaTextContrast } from "./brandingTheme.js";
import { deriveBrandColorsFromPalette, ensurePrimaryButtonContrast } from "./logoBrandColors.js";

describe("deriveBrandColorsFromPalette accessibility", () => {
  it("picks a contrasting secondary when two hues exist", () => {
    const result = deriveBrandColorsFromPalette(["#047857", "#d97706", "#ffffff"]);
    expect(result).not.toBeNull();
    expect(result!.primaryColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(result!.secondaryColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(result!.secondaryColor).not.toBe(result!.primaryColor);
    expect(result!.accessibility.primaryPassesAaText).toBe(true);
    expect(result!.accessibility.accentPassesAaText).toBe(true);
  });

  it("darkens light yellow logo swatches to accessible primary fills", () => {
    const result = deriveBrandColorsFromPalette(["#fef08a", "#fde047", "#ffffff"]);
    expect(result).not.toBeNull();
    expect(meetsWcagAaTextContrast(result!.accessibility.primaryTextRatio)).toBe(true);
    expect(meetsWcagAaTextContrast(result!.accessibility.accentTextRatio)).toBe(true);
  });

  it("handles pale orange logos with accessible primary and accent", () => {
    const result = deriveBrandColorsFromPalette(["#ffb347", "#ffd194", "#ffffff"]);
    expect(result).not.toBeNull();
    expect(result!.accessibility.primaryPassesAaText).toBe(true);
    expect(result!.accessibility.accentPassesAaText).toBe(true);
  });

  it("generates an accessible accent for single-hue logos", () => {
    const result = deriveBrandColorsFromPalette(["#047857", "#065f46", "#ecfdf5"]);
    expect(result).not.toBeNull();
    expect(result!.accessibility.primaryPassesAaText).toBe(true);
    expect(result!.accessibility.accentPassesAaText).toBe(true);
    expect(result!.secondaryColor).not.toBe(result!.primaryColor);
  });

  it("returns null when only neutral swatches are present", () => {
    expect(deriveBrandColorsFromPalette(["#ffffff", "#f5f5f5", "#eeeeee"])).toBeNull();
  });
});

describe("ensurePrimaryButtonContrast", () => {
  it("delegates to shared accent contrast adjustment", () => {
    const adjusted = ensurePrimaryButtonContrast("#fef08a");
    expect(meetsWcagAaTextContrast(getContrastRatio("#ffffff", adjusted))).toBe(true);
    expect(adjusted).toMatch(/^#[0-9a-f]{6}$/);
  });
});
