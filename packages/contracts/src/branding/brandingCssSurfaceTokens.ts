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
import { NEUTRAL_SURFACES } from "./brandingNeutralPalette.js";

/** Muted text carries the same fit margin as every other token — see `FIT_MARGIN`. */
const MUTED_FIT_MIN_RATIO = WCAG_AA_TEXT_MIN_RATIO + FIT_MARGIN;

/** Neutral (achromatic) text: shadcn's base palette has no hue on ink either. */
const NEUTRAL_HUE = 0;
const NEUTRAL_SATURATION = 0;

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

function pickInk(
  backgrounds: readonly HslColor[],
  lightness: readonly number[],
  minRatio?: number,
): string {
  return pickAccessibleTextToken(NEUTRAL_HUE, NEUTRAL_SATURATION, backgrounds, lightness, minRatio);
}

/**
 * Builds light- or dark-mode surface and sidebar tokens on the stock shadcn/ui
 * neutral base. Ink tokens are still fitted for WCAG AA (with `FIT_MARGIN`) against
 * every surface — and every resting brand/status tint — they are read on.
 */
export function buildBrandingSurfaceTokens(
  mode: BrandingThemeMode,
  tintSources: readonly HslColor[] = [],
): Record<string, string> {
  const surface = NEUTRAL_SURFACES[mode];
  const { background, card, muted, raised, sidebar, sidebarAccent } = surface;
  const light = mode === "light";

  const foreground = pickInk(
    [background, card, muted],
    light ? descendingLightness(4, 0) : ascendingLightness(98, 100),
  );
  const mutedForeground = pickInk(
    mutedForegroundBackgrounds(mode, [card, muted, background, raised], tintSources),
    light ? descendingLightness(45, 20) : ascendingLightness(64, 85),
    MUTED_FIT_MIN_RATIO,
  );
  const sidebarForeground = pickInk(
    [sidebar, sidebarAccent],
    light ? descendingLightness(26, 10) : ascendingLightness(90, 98),
  );
  const sidebarAccentForeground = pickInk(
    [sidebarAccent],
    light ? descendingLightness(9, 0) : ascendingLightness(96, 100),
  );
  const sidebarMutedForeground = pickInk(
    mutedForegroundBackgrounds(mode, [sidebar, sidebarAccent], tintSources),
    light ? descendingLightness(45, 20) : ascendingLightness(64, 85),
    MUTED_FIT_MIN_RATIO,
  );
  const accentForeground = pickInk(
    [muted],
    light ? descendingLightness(9, 0) : ascendingLightness(98, 100),
  );

  const border = hslColorToToken(surface.border);
  return {
    "--background": hslColorToToken(background),
    "--foreground": foreground,
    "--card": hslColorToToken(card),
    "--card-foreground": foreground,
    "--popover": hslColorToToken(card),
    "--popover-foreground": foreground,
    "--muted": hslColorToToken(muted),
    "--muted-foreground": mutedForeground,
    "--accent": hslColorToToken(muted),
    "--accent-foreground": accentForeground,
    "--border": border,
    "--input": border,
    "--sidebar-background": hslColorToToken(sidebar),
    "--sidebar-foreground": sidebarForeground,
    "--sidebar-accent": hslColorToToken(sidebarAccent),
    "--sidebar-accent-foreground": sidebarAccentForeground,
    "--sidebar-border": hslColorToToken(light ? surface.border : sidebarAccent),
    "--sidebar-muted-foreground": sidebarMutedForeground,
  };
}
