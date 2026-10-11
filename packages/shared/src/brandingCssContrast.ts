import {
  type BrandingThemeMode,
  type HslColor,
  clamp,
  getContrastRatio,
  hslColorToHex,
  hslColorToToken,
  meetsWcagAaTextContrast,
  tone,
} from "./brandingColorUtils.js";

function withAbsoluteLightness(color: HslColor, targetLightness: number): HslColor {
  return { ...color, l: clamp(targetLightness, 0, 100) };
}

/**
 * Strongest same-token tint that appears behind same-token text AT REST.
 *
 * Measured from the frontend, not chosen: light mode has
 * `bg-primary/15 text-primary` (calendar, PermissionMatrixRow) alongside ~188
 * `/10` chips, while dark mode only ever uses `dark:bg-<role>/10`.
 */
export const MAX_RESTING_TINT_BY_MODE: Record<BrandingThemeMode, number> = {
  light: 0.15,
  dark: 0.1,
};

/**
 * The two surfaces a semantic token is read against as text.
 *
 * Mirrors `buildBrandingSurfaceTokens` exactly — light mode's card is pure white
 * and its background is a near-white brand tint (l=98), dark mode's card and
 * background are near-black (l=8 / l=5). Keep these in step: a token tuned only
 * against white still fails on the tinted background.
 */
export function brandingSurfaces(
  mode: BrandingThemeMode,
  surfaceHue: number,
): { card: HslColor; background: HslColor } {
  return mode === "light"
    ? { card: { h: 0, s: 0, l: 100 }, background: { h: surfaceHue, s: 20, l: 98 } }
    : { card: { h: surfaceHue, s: 20, l: 8 }, background: { h: surfaceHue, s: 20, l: 5 } };
}

/** `bg-<token>/<alpha>` composited over `base` — what the eye actually sees. */
function tintHex(tintHex: string, baseHex: string, alpha: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const rgb = [0, 1, 2].map((i) =>
    Math.round(channel(tintHex, i) * alpha + channel(baseHex, i) * (1 - alpha)),
  );
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Best contrast the token can achieve as a fill, using whichever text polarity wins. */
function fillRoleRatio(color: HslColor): number {
  const hex = hslColorToHex(color);
  return Math.max(
    getContrastRatio("#ffffff", hex) ?? 0,
    getContrastRatio(hslColorToHex({ h: color.h, s: 30, l: 12 }), hex) ?? 0,
  );
}

/**
 * Worst-case contrast of the token used as TEXT: on each surface, and on its own
 * resting tint over each surface.
 */
function textRoleRatio(colorHex: string, mode: BrandingThemeMode, surfaces: HslColor[]): number {
  const tint = MAX_RESTING_TINT_BY_MODE[mode];
  const ratios: number[] = [];
  for (const surface of surfaces) {
    const surfaceHex = hslColorToHex(surface);
    ratios.push(getContrastRatio(colorHex, surfaceHex) ?? 0);
    ratios.push(getContrastRatio(colorHex, tintHex(colorHex, surfaceHex, tint)) ?? 0);
  }
  return Math.min(...ratios);
}

/**
 * Walks a colour's lightness in the direction its theme needs until it satisfies
 * every role it is used in, returning the closest passing value.
 *
 * The direction is what previously went wrong: the pipeline stepped *down* from
 * any base and stopped as soon as either white OR dark text passed on the fill.
 * For a mid-tone brand colour that accepts a dark label, it stopped immediately
 * and shipped a bright fill — which satisfies the fill role and destroys the text
 * role. Light themes must reach a fill that carries WHITE text; dark themes must
 * reach one that carries DARK text. Those two conditions each imply that the
 * token also works as text on the theme's surfaces, including its own tint.
 */
function fitTokenToAllRoles(
  color: HslColor,
  mode: BrandingThemeMode,
  surfaces: HslColor[],
): HslColor {
  const step = mode === "light" ? -2 : 2;
  let best = color;
  let bestScore = -Infinity;

  for (let i = 0; i < 45; i += 1) {
    const candidate = tone(color, {
      l: step * i,
      // Desaturate as the walk gets long so extreme hues stay tasteful rather
      // than turning into a pure hue at the lightness limit.
      s: -Math.min(Math.round(color.s * 0.7), i * 2),
    });
    if (candidate.l <= 0 || candidate.l >= 100) break;

    const score = Math.min(
      fillRoleRatio(candidate),
      textRoleRatio(hslColorToHex(candidate), mode, surfaces),
    );
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
    if (score >= 4.5) return candidate;
  }

  // Nothing fully passed (extreme hue): return the best available so the result is
  // never worse than the input.
  return best;
}

/** Adapts a primary colour for dark-mode UI fills. */
export function darkModePrimaryUi(primary: HslColor): HslColor {
  const softened = tone(primary, { s: -Math.round(primary.s * 0.3) });
  return withAbsoluteLightness(softened, clamp(primary.l + 18, 35, 55));
}

/** Adapts a secondary colour for dark-mode UI fills. */
export function darkModeSecondaryUi(secondary: HslColor): HslColor {
  const softened = tone(secondary, { s: -Math.round(secondary.s * 0.35) });
  return withAbsoluteLightness(softened, clamp(secondary.l - 20, 30, 60));
}

/**
 * Adjusts a fill until the token satisfies every role it is used in: carrying
 * theme-appropriate text as a fill, and being legible as text on the theme's
 * surfaces and on its own resting tint.
 *
 * @param color Brand colour to fit.
 * @param mode Theme polarity — decides which way to walk lightness.
 * @param surfaces Surfaces the token is read against as text. Defaults to the
 *   mode's card and background for `color.h` when omitted, so existing callers
 *   that only care about the primary hue keep working.
 */
export function ensureAccessibleFillSurface(
  color: HslColor,
  mode: BrandingThemeMode = "light",
  surfaces?: readonly HslColor[],
): HslColor {
  const resolved = surfaces
    ? [...surfaces]
    : [brandingSurfaces(mode, color.h).card, brandingSurfaces(mode, color.h).background];
  return fitTokenToAllRoles(color, mode, resolved);
}

/** Selects the strongest accessible text token across all supplied backgrounds. */
export function pickAccessibleTextToken(
  hue: number,
  saturation: number,
  backgrounds: readonly HslColor[],
  candidateLightness: readonly number[],
): string {
  for (const lightness of candidateLightness) {
    const foreground = { h: hue, s: saturation, l: lightness };
    const fgHex = hslColorToHex(foreground);
    const allPass = backgrounds.every((background) =>
      meetsWcagAaTextContrast(getContrastRatio(fgHex, hslColorToHex(background))),
    );
    if (allPass) return hslColorToToken(foreground);
  }

  let bestLightness = candidateLightness[0] ?? 50;
  let bestMinRatio = 0;
  for (const lightness of candidateLightness) {
    const fgHex = hslColorToHex({ h: hue, s: saturation, l: lightness });
    const minRatio = Math.min(
      ...backgrounds.map((background) => getContrastRatio(fgHex, hslColorToHex(background)) ?? 0),
    );
    if (minRatio > bestMinRatio) {
      bestMinRatio = minRatio;
      bestLightness = lightness;
    }
  }
  return hslColorToToken({ h: hue, s: saturation, l: bestLightness });
}

/** Produces an inclusive descending lightness range. */
export function descendingLightness(from: number, to: number): number[] {
  const values: number[] = [];
  for (let lightness = from; lightness >= to; lightness -= 1) values.push(lightness);
  return values;
}

/** Produces an inclusive ascending lightness range. */
export function ascendingLightness(from: number, to: number): number[] {
  const values: number[] = [];
  for (let lightness = from; lightness <= to; lightness += 1) values.push(lightness);
  return values;
}

/** Chooses an accessible foreground token for a coloured surface. */
export function foregroundForSurface(surface: HslColor): string {
  const surfaceHex = hslColorToHex(surface);
  const whiteRatio = getContrastRatio("#ffffff", surfaceHex) ?? 0;
  const darkText = hslColorToHex(tone(surface, { s: -15, l: -42 }));
  const darkRatio = getContrastRatio(darkText, surfaceHex) ?? 0;
  const whiteOk = meetsWcagAaTextContrast(whiteRatio);
  const darkOk = meetsWcagAaTextContrast(darkRatio);

  if (whiteOk && (!darkOk || whiteRatio >= darkRatio)) return "0 0% 100%";
  if (darkOk) return `${surface.h} 30% 12%`;
  return whiteRatio >= darkRatio ? "0 0% 100%" : `${surface.h} 30% 12%`;
}

/**
 * Builds an accessible semantic fill and foreground pair.
 *
 * Fits the fill to all three token roles (not just the fill/foreground pair) so
 * that the same token is also usable as `text-<role>` and inside
 * `bg-<role>/10 text-<role>` chips.
 */
export function ensureAccessibleSemanticPair(
  base: HslColor,
  mode: BrandingThemeMode = "light",
  surfaces?: readonly HslColor[],
): { fill: string; foreground: string } {
  const resolved = surfaces
    ? [...surfaces]
    : [brandingSurfaces(mode, base.h).card, brandingSurfaces(mode, base.h).background];
  const fitted = fitTokenToAllRoles(base, mode, resolved);
  return {
    fill: hslColorToToken(fitted),
    foreground: foregroundForSurface(fitted),
  };
}
