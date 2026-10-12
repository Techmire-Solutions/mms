import type { BrandingThemeMode, HslColor } from "./brandingColorUtils.js";
import { hexToHslColor } from "./brandingColorUtils.js";
import { ensureAccessibleSemanticPair, brandingSurfaces } from "./brandingCssContrast.js";

/**
 * Starting points for the semantic status fills — not final values: each is fitted
 * to satisfy all three token roles (fill, text on the theme surfaces, and text on
 * its own tint).
 */
const SEMANTIC_STATUS_BASES: Record<BrandingThemeMode, Record<string, HslColor>> = {
  light: {
    "--destructive": { h: 0, s: 72, l: 51 },
    "--success": { h: 142, s: 71, l: 36 },
    "--warning": { h: 32, s: 95, l: 44 },
    "--info": { h: 217, s: 91, l: 52 },
  },
  dark: {
    "--destructive": { h: 0, s: 63, l: 31 },
    "--success": { h: 142, s: 65, l: 32 },
    "--warning": { h: 32, s: 90, l: 38 },
    "--info": { h: 217, s: 88, l: 46 },
  },
};

export interface SemanticStatusPair {
  /** CSS variable name, e.g. `--destructive`. */
  key: string;
  /** Fitted fill token value. */
  fill: string;
  /** The fitted fill as a colour, so callers can use it as a tint source. */
  fillColor: HslColor;
  foreground: string;
}

/**
 * Fits every semantic status fill, exposing the resolved colour as well as the token
 * strings. The surface tokens need the colours (a status callout can sit behind
 * `muted-foreground` text), so the same fit is used for both rather than recomputed.
 *
 * `surfaceHue` should be the brand surface hue so the constraint is evaluated against
 * the real `--card` / `--background` values rather than pure white.
 */
export function buildSemanticStatusPairs(
  mode: BrandingThemeMode,
  surfaceHue = 0,
): SemanticStatusPair[] {
  const surfaces = brandingSurfaces(mode, surfaceHue);
  return Object.entries(SEMANTIC_STATUS_BASES[mode]).map(([key, base]) => {
    // Evaluate against the REAL surfaces — the same hues the surface tokens use.
    // Re-hueing them per status token made the constraint disagree with the shipped
    // background by a few hundredths of a ratio point, which is enough to fail.
    const pair = ensureAccessibleSemanticPair(base, mode, [surfaces.card, surfaces.background]);
    return {
      key,
      fill: pair.fill,
      fillColor: hexToHslColor(pair.fill) ?? base,
      foreground: pair.foreground,
    };
  });
}

/** Builds accessible semantic status fill and foreground tokens. */
export function buildSemanticStatusTokens(
  mode: BrandingThemeMode,
  surfaceHue = 0,
): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const { key, fill, foreground } of buildSemanticStatusPairs(mode, surfaceHue)) {
    tokens[key] = fill;
    tokens[`${key}-foreground`] = foreground;
  }
  return tokens;
}
