import { BRANDING_THEME_PRESETS } from "./brandingTypes.js";
import {
  DEFAULT_PRIMARY,
  clamp,
  hexToHslColor,
  hslColorToHex,
  type HslColor,
} from "./brandingColorConvert.js";
import {
  ensureAccentButtonContrast,
  getContrastRatio,
  meetsWcagAaTextContrast,
} from "./brandingColorContrast.js";

const BRAND_PRESET_LOOKUP = new Map(
  BRANDING_THEME_PRESETS.map((preset) => [preset.primaryColor.toLowerCase(), preset]),
);

export type BrandingHarmonyScheme =
  "split-complementary" | "complementary" | "analogous" | "triadic";

export const BRANDING_HARMONY_SCHEMES: readonly {
  id: BrandingHarmonyScheme;
  labelKey: string;
}[] = [
  { id: "split-complementary", labelKey: "theme.harmonySplit" },
  { id: "complementary", labelKey: "theme.harmonyComplementary" },
  { id: "analogous", labelKey: "theme.harmonyAnalogous" },
  { id: "triadic", labelKey: "theme.harmonyTriadic" },
] as const;

/**
 * Suggests a harmonious accent colour for a given primary brand colour and scheme.
 * Enforces accessible WCAG AA contrast on solid fills.
 */
export function suggestHarmoniousSecondaryColor(
  primaryHex: string,
  scheme: BrandingHarmonyScheme = "split-complementary",
): string {
  const primary = hexToHslColor(primaryHex) ?? DEFAULT_PRIMARY;

  let hueOffset = 150;
  if (scheme === "complementary") hueOffset = 180;
  else if (scheme === "analogous") hueOffset = 35;
  else if (scheme === "triadic") hueOffset = 120;
  else if (scheme === "split-complementary") hueOffset = 150;

  const targetHue = (primary.h + hueOffset) % 360;
  const accent: HslColor = {
    h: targetHue,
    s: clamp(Math.round(primary.s * 0.9), 55, 92),
    l: clamp(Math.round(primary.l + (scheme === "analogous" ? 12 : 20)), 38, 52),
  };

  return ensureAccentButtonContrast(hslColorToHex(accent));
}

/**
 * Suggests a harmonious accent colour for a given primary brand colour.
 * Uses split-complementary hue rotation and enforces accessible contrast on solid fills.
 */
export function suggestSecondaryColor(primaryHex: string): string {
  const normalized = primaryHex.trim().toLowerCase();
  const preset = BRAND_PRESET_LOOKUP.get(normalized);
  if (preset) return preset.secondaryColor;

  return suggestHarmoniousSecondaryColor(primaryHex, "split-complementary");
}

/** Contrast metadata for a curated branding preset (primary + accent vs white). */
export interface BrandingPresetAccessibility {
  primaryTextRatio: number | null;
  accentTextRatio: number | null;
  primaryPassesAaText: boolean;
  accentPassesAaText: boolean;
}

export function getBrandingPresetAccessibility(
  primaryHex: string,
  accentHex: string,
): BrandingPresetAccessibility {
  const primaryTextRatio = getContrastRatio("#ffffff", primaryHex);
  const accentTextRatio = getContrastRatio("#ffffff", accentHex);
  return {
    primaryTextRatio,
    accentTextRatio,
    primaryPassesAaText: meetsWcagAaTextContrast(primaryTextRatio),
    accentPassesAaText: meetsWcagAaTextContrast(accentTextRatio),
  };
}
