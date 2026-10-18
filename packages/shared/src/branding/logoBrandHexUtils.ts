import { ensureAccentButtonContrast, type BrandingPresetAccessibility } from "./brandingTheme.js";

export interface LogoColorProportion {
  hex: string;
  percentage: number;
}

/** Brand colours inferred from a logo image palette. */
export interface LogoBrandColors {
  primaryColor: string;
  secondaryColor: string;
  /** Ranked dominant swatches extracted from the logo (most frequent first). */
  palette: readonly string[];
  /** Proportional color distribution (0–100%) for spectrum visualization. */
  proportions?: readonly LogoColorProportion[];
  /** WCAG AA contrast for white text on primary and accent fills. */
  accessibility: BrandingPresetAccessibility;
}

export interface DeriveBrandColorsFromPaletteOptions {
  /** Minimum HSL saturation (0–100) to treat a swatch as chromatic. */
  minSaturation?: number;
  /** Lightness band for primary candidates. */
  minLightness?: number;
  maxLightness?: number;
  /** Minimum hue separation between primary and secondary. */
  minHueSeparation?: number;
}

/** Normalizes a hex colour to lowercase `#rrggbb`, or `null` when invalid. */
export function normalizeBrandHex(hex: string): string | null {
  let raw = hex.trim().replace(/^#/, "");
  if (raw.length === 3) {
    raw = raw
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return `#${raw.toLowerCase()}`;
}

/** Darkens a colour until white button text meets WCAG AA (4.5:1). */
export function ensurePrimaryButtonContrast(primaryHex: string): string {
  return ensureAccentButtonContrast(primaryHex);
}
