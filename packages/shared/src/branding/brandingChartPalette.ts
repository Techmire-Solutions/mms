import type { BrandingThemeMode } from "./brandingColorUtils.js";
import { brandingTokenToHex } from "./brandingColorUtils.js";
import { buildBrandingCssVariables } from "./brandingCssVariables.js";

/** Hex palette derived from institution brand colours for chart libraries. */
export interface BrandingChartPaletteHex {
  primary: string;
  secondary: string;
  charts: readonly [string, string, string, string, string];
}

/**
 * Resolves chart-ready hex colours from brand primary/secondary for the active theme mode.
 */
export function resolveBrandingChartPaletteHex(
  primaryHex: string,
  secondaryHex: string,
  mode: BrandingThemeMode,
): BrandingChartPaletteHex {
  const vars = buildBrandingCssVariables(primaryHex, secondaryHex, mode);
  const toHex = (key: string): string => brandingTokenToHex(vars[key] ?? "", primaryHex);
  return {
    primary: toHex("--primary"),
    secondary: toHex("--secondary"),
    charts: [
      toHex("--chart-1"),
      toHex("--chart-2"),
      toHex("--chart-3"),
      toHex("--chart-4"),
      toHex("--chart-5"),
    ],
  };
}
