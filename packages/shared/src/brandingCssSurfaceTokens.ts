import { type BrandingThemeMode, hslColorToToken } from "./brandingColorUtils.js";
import {
  ascendingLightness,
  descendingLightness,
  pickAccessibleTextToken,
} from "./brandingCssContrast.js";

function buildLightModeSurfaceTokens(
  surfaceHue: number,
  accentHue: number,
): Record<string, string> {
  const background = { h: surfaceHue, s: 20, l: 98 };
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
    [muted, background, { h: surfaceHue, s: 15, l: 91 }],
    descendingLightness(37, 30),
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
    [sidebarBackground, sidebarAccent],
    ascendingLightness(55, 72),
  );

  return {
    "--background": hslColorToToken(background),
    "--foreground": foreground,
    "--card": "0 0% 100%",
    "--card-foreground": foreground,
    "--popover": "0 0% 100%",
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

function buildDarkModeSurfaceTokens(surfaceHue: number, accentHue: number): Record<string, string> {
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
    [muted, background],
    ascendingLightness(55, 72),
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
    [sidebarBackground, sidebarAccent],
    ascendingLightness(50, 72),
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
): Record<string, string> {
  return mode === "light"
    ? buildLightModeSurfaceTokens(surfaceHue, accentHue)
    : buildDarkModeSurfaceTokens(surfaceHue, accentHue);
}
