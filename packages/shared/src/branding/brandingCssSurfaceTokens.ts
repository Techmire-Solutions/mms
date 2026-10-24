import {
  type BrandingThemeMode,
  type HslColor,
  WCAG_AA_TEXT_MIN_RATIO,
  hslColorToToken,
} from "./brandingColorUtils.js";
import {
  FIT_MARGIN,
  ascendingLightness,
  descendingLightness,
  pickAccessibleTextToken,
  restingTintedSurfaces,
} from "./brandingCssContrast.js";

/** Muted text carries the same fit margin as every other token — see `FIT_MARGIN`. */
const MUTED_FIT_MIN_RATIO = WCAG_AA_TEXT_MIN_RATIO + FIT_MARGIN;

/**
 * `--muted-foreground` is the token most often read *inside someone else's tint*
 * (`bg-primary/5 text-muted-foreground`, status callouts), so it is fitted against
 * the tinted variants of its surfaces too — not just the plain ones. Without that
 * term the palette shipped below AA for the emerald/teal presets and any light brand.
 */
function mutedForegroundBackgrounds(
  mode: BrandingThemeMode,
  surfaces: readonly HslColor[],
  tintSources: readonly HslColor[],
): HslColor[] {
  return [...surfaces, ...restingTintedSurfaces(mode, surfaces, tintSources)];
}

function buildLightModeSurfaceTokens(
  surfaceHue: number,
  accentHue: number,
  tintSources: readonly HslColor[],
): Record<string, string> {
  const card = { h: 0, s: 0, l: 100 };
  const background = { h: surfaceHue, s: 20, l: 98 };
  const raised = { h: surfaceHue, s: 15, l: 91 };
  const muted = { h: surfaceHue, s: 15, l: 94 };
  const sidebarBackground = { h: surfaceHue, s: 30, l: 10 };
  const sidebarAccent = { h: surfaceHue, s: 25, l: 16 };
  const foreground = pickAccessibleTextToken(
    surfaceHue,
    30,
    [background],
    descendingLightness(10, 8),
  );
  const mutedForeground = pickAccessibleTextToken(
    surfaceHue,
    10,
    mutedForegroundBackgrounds("light", [card, muted, background, raised], tintSources),
    descendingLightness(37, 20),
    MUTED_FIT_MIN_RATIO,
  );
  const sidebarForeground = pickAccessibleTextToken(
    accentHue,
    15,
    [sidebarBackground],
    ascendingLightness(85, 92),
  );
  const sidebarAccentForeground = pickAccessibleTextToken(
    accentHue,
    15,
    [sidebarAccent],
    ascendingLightness(92, 96),
  );
  const sidebarMutedForeground = pickAccessibleTextToken(
    surfaceHue,
    10,
    mutedForegroundBackgrounds("light", [sidebarBackground, sidebarAccent], tintSources),
    ascendingLightness(55, 72),
    MUTED_FIT_MIN_RATIO,
  );

  return {
    "--background": hslColorToToken(background),
    "--foreground": foreground,
    "--card": `0 0% 100%`,
    "--card-foreground": foreground,
    "--popover": `0 0% 100%`,
    "--popover-foreground": foreground,
    "--muted": hslColorToToken(muted),
    "--muted-foreground": mutedForeground,
    "--border": `${surfaceHue} 15% 90%`,
    "--input": `${surfaceHue} 15% 90%`,
    "--sidebar-background": hslColorToToken(sidebarBackground),
    "--sidebar-foreground": sidebarForeground,
    "--sidebar-accent": hslColorToToken(sidebarAccent),
    "--sidebar-accent-foreground": sidebarAccentForeground,
    "--sidebar-border": `${surfaceHue} 20% 18%`,
    "--sidebar-muted-foreground": sidebarMutedForeground,
  };
}

function buildDarkModeSurfaceTokens(
  surfaceHue: number,
  accentHue: number,
  tintSources: readonly HslColor[],
): Record<string, string> {
  const background = { h: surfaceHue, s: 20, l: 5 };
  const muted = { h: surfaceHue, s: 15, l: 14 };
  const card = { h: surfaceHue, s: 20, l: 8 };
  const sidebarBackground = { h: surfaceHue, s: 25, l: 6 };
  const sidebarAccent = { h: surfaceHue, s: 20, l: 12 };
  const foreground = pickAccessibleTextToken(
    accentHue,
    15,
    [background],
    ascendingLightness(92, 96),
  );
  const mutedForeground = pickAccessibleTextToken(
    surfaceHue,
    10,
    mutedForegroundBackgrounds("dark", [muted, background, card], tintSources),
    ascendingLightness(55, 82),
    MUTED_FIT_MIN_RATIO,
  );
  const sidebarForeground = pickAccessibleTextToken(
    accentHue,
    15,
    [sidebarBackground],
    ascendingLightness(85, 92),
  );
  const sidebarAccentForeground = pickAccessibleTextToken(
    accentHue,
    15,
    [sidebarAccent],
    ascendingLightness(92, 96),
  );
  const sidebarMutedForeground = pickAccessibleTextToken(
    surfaceHue,
    10,
    mutedForegroundBackgrounds("dark", [sidebarBackground, sidebarAccent], tintSources),
    ascendingLightness(50, 82),
    MUTED_FIT_MIN_RATIO,
  );

  return {
    "--background": hslColorToToken(background),
    "--foreground": foreground,
    "--card": hslColorToToken(card),
    "--card-foreground": foreground,
    "--popover": hslColorToToken(card),
    "--popover-foreground": foreground,
    "--muted": hslColorToToken(muted),
    "--muted-foreground": mutedForeground,
    "--border": `${surfaceHue} 15% 16%`,
    "--input": `${surfaceHue} 15% 16%`,
    "--sidebar-background": hslColorToToken(sidebarBackground),
    "--sidebar-foreground": sidebarForeground,
    "--sidebar-accent": hslColorToToken(sidebarAccent),
    "--sidebar-accent-foreground": sidebarAccentForeground,
    "--sidebar-border": `${surfaceHue} 15% 14%`,
    "--sidebar-muted-foreground": sidebarMutedForeground,
  };
}

/** Builds light- or dark-mode surface and sidebar tokens. */
export function buildBrandingSurfaceTokens(
  mode: BrandingThemeMode,
  surfaceHue: number,
  accentHue: number,
  tintSources: readonly HslColor[] = [],
): Record<string, string> {
  return mode === "light"
    ? buildLightModeSurfaceTokens(surfaceHue, accentHue, tintSources)
    : buildDarkModeSurfaceTokens(surfaceHue, accentHue, tintSources);
}
