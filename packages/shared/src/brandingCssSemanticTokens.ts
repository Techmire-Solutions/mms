import type { BrandingThemeMode } from "./brandingColorUtils.js";
import { ensureAccessibleSemanticPair, brandingSurfaces } from "./brandingCssContrast.js";

/**
 * Builds accessible semantic status fill and foreground tokens.
 *
 * The bases are starting points, not final values: each is fitted to satisfy all
 * three token roles (fill, text on the theme surfaces, and text on its own tint).
 * `surfaceHue` should be the brand surface hue so the constraint is evaluated
 * against the real `--card` / `--background` values rather than pure white.
 */
export function buildSemanticStatusTokens(
  mode: BrandingThemeMode,
  surfaceHue = 0,
): Record<string, string> {
  const bases =
    mode === "light"
      ? {
          "--destructive": { h: 0, s: 72, l: 51 },
          "--success": { h: 142, s: 71, l: 36 },
          "--warning": { h: 32, s: 95, l: 44 },
          "--info": { h: 217, s: 91, l: 52 },
        }
      : {
          "--destructive": { h: 0, s: 63, l: 31 },
          "--success": { h: 142, s: 65, l: 32 },
          "--warning": { h: 32, s: 90, l: 38 },
          "--info": { h: 217, s: 88, l: 46 },
        };

  const surfaces = brandingSurfaces(mode, surfaceHue);
  const tokens: Record<string, string> = {};
  for (const [key, base] of Object.entries(bases)) {
    // Evaluate against the REAL surfaces — the same hues the surface tokens use.
    // Re-hueing them per status token made the constraint disagree with the shipped
    // background by a few hundredths of a ratio point, which is enough to fail.
    const pair = ensureAccessibleSemanticPair(base, mode, [surfaces.card, surfaces.background]);
    tokens[key] = pair.fill;
    tokens[`${key}-foreground`] = pair.foreground;
  }
  return tokens;
}
