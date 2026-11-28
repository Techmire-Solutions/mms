import type { BrandingThemeMode, HslColor } from "./brandingColorUtils.js";

/**
 * Stock shadcn/ui "neutral" base palette. Surfaces, borders and the sidebar carry
 * no brand hue; only the brand fills (primary/secondary/ring/charts) follow the
 * tenant's colours. `buildBrandingSurfaceTokens` emits these and every contrast
 * fit reads against them, so the guarantee and the rendered page cannot drift.
 */
export const NEUTRAL_SURFACES: Record<
  BrandingThemeMode,
  Record<
    "background" | "card" | "muted" | "raised" | "border" | "sidebar" | "sidebarAccent",
    HslColor
  >
> = {
  light: {
    background: { h: 0, s: 0, l: 100 },
    card: { h: 0, s: 0, l: 100 },
    muted: { h: 0, s: 0, l: 96 },
    raised: { h: 0, s: 0, l: 93 },
    border: { h: 0, s: 0, l: 90 },
    sidebar: { h: 0, s: 0, l: 98 },
    sidebarAccent: { h: 0, s: 0, l: 94 },
  },
  dark: {
    background: { h: 0, s: 0, l: 4 },
    card: { h: 0, s: 0, l: 9 },
    muted: { h: 0, s: 0, l: 15 },
    raised: { h: 0, s: 0, l: 12 },
    border: { h: 0, s: 0, l: 15 },
    sidebar: { h: 0, s: 0, l: 9 },
    sidebarAccent: { h: 0, s: 0, l: 15 },
  },
};
