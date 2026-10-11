import type { AppTranslationKey } from "./appTranslations.js";

/** Chart palette tier — accessible palettes are the recommended default. */
export type ChartPaletteCategory = "accessible" | "brand" | "decorative";

export interface ChartPaletteDef {
  readonly id: string;
  readonly labelKey: AppTranslationKey;
  readonly category: ChartPaletteCategory;
  readonly colors: readonly string[];
  /** Marks palettes validated for colour-vision deficiency (Okabe-Ito, Paul Tol). */
  readonly colorblindSafe: boolean;
}

/**
 * Curated Recharts / analytics colour palettes.
 * Accessible sets follow Okabe-Ito and Paul Tol guidance; decorative sets are mono-hue ramps.
 */
export const CHART_PALETTE_DEFS: readonly ChartPaletteDef[] = [
  {
    id: "accessibleColorblind",
    labelKey: "charts.paletteOkabeIto",
    category: "accessible",
    colorblindSafe: true,
    colors: ["#0072B2", "#E69F00", "#009E73", "#F0E442", "#D55E00", "#CC79A7", "#56B4E9"],
  },
  {
    id: "tolVibrant",
    labelKey: "charts.paletteTolVibrant",
    category: "accessible",
    colorblindSafe: true,
    colors: ["#EE7733", "#0077BB", "#33BBEE", "#EE3377", "#CC3311", "#009988", "#BBBBBB"],
  },
  {
    id: "tolMuted",
    labelKey: "charts.paletteTolMuted",
    category: "accessible",
    colorblindSafe: true,
    colors: [
      "#88CCEE",
      "#44AA99",
      "#117733",
      "#999933",
      "#DDCC77",
      "#CC6677",
      "#882255",
      "#AA4499",
    ],
  },
  {
    id: "brand",
    labelKey: "charts.paletteBrand",
    category: "brand",
    colorblindSafe: false,
    colors: [],
  },
  {
    id: "emeraldForest",
    labelKey: "charts.paletteEmeraldForest",
    category: "decorative",
    colorblindSafe: false,
    colors: ["#10b981", "#34d399", "#059669", "#047857", "#065f46"],
  },
  {
    id: "oceanBreeze",
    labelKey: "charts.paletteOceanBreeze",
    category: "decorative",
    colorblindSafe: false,
    colors: ["#3b82f6", "#60a5fa", "#2563eb", "#1d4ed8", "#1e40af"],
  },
  {
    id: "cosmicViolet",
    labelKey: "charts.paletteCosmicViolet",
    category: "decorative",
    colorblindSafe: false,
    colors: ["#8b5cf6", "#a78bfa", "#7c3aed", "#6d28d9", "#5b21b6"],
  },
  {
    id: "sunsetGlow",
    labelKey: "charts.paletteSunsetGlow",
    category: "decorative",
    colorblindSafe: false,
    colors: ["#f59e0b", "#fbbf24", "#d97706", "#b45309", "#92400e"],
  },
  {
    id: "cyberpunkNeon",
    labelKey: "charts.paletteCyberpunkNeon",
    category: "decorative",
    colorblindSafe: false,
    colors: ["#ec4899", "#f43f5e", "#d946ef", "#a855f7", "#e11d48"],
  },
] as const;

/** Recommended default for new charts and report widgets. */
export const DEFAULT_CHART_PALETTE_ID = "accessibleColorblind" as const;

const CHART_PALETTE_LOOKUP = new Map(CHART_PALETTE_DEFS.map((def) => [def.id, def]));

/** Hex ramps for dashboard pinned-widget chart fallbacks (when brand palette unavailable). */
export const WIDGET_CHART_PALETTES: Record<string, readonly string[]> = {
  emerald: ["#10b981", "#34d399", "#059669", "#047857", "#065f46"],
  green: ["#10b981", "#34d399", "#059669", "#047857", "#065f46"],
  blue: ["#3b82f6", "#60a5fa", "#2563eb", "#1d4ed8", "#1e40af"],
  violet: ["#8b5cf6", "#a78bfa", "#7c3aed", "#6d28d9", "#5b21b6"],
  amber: ["#f59e0b", "#fbbf24", "#d97706", "#b45309", "#92400e"],
  red: ["#ef4444", "#f87171", "#dc2626", "#b91c1c", "#991b1b"],
};

/** Static decorative/accessible palettes as a flat id → colors map (excludes dynamic `brand`). */
export function getStaticChartPaletteMap(): Record<string, readonly string[]> {
  const paletteColorsById: Record<string, readonly string[]> = {};
  for (const paletteDefinition of CHART_PALETTE_DEFS) {
    if (paletteDefinition.id !== "brand" && paletteDefinition.colors.length > 0) {
      paletteColorsById[paletteDefinition.id] = paletteDefinition.colors;
    }
  }
  return paletteColorsById;
}

/** Resolves palette colours; `brandColors` supplies the institution chart ramp when id is `brand`. */
export function getChartPaletteColors(
  id: string,
  brandColors?: readonly string[],
): readonly string[] {
  if (id === "brand" && brandColors && brandColors.length > 0) {
    return brandColors;
  }
  const def = CHART_PALETTE_LOOKUP.get(id);
  if (def && def.colors.length > 0) return def.colors;
  const fallback = CHART_PALETTE_LOOKUP.get(DEFAULT_CHART_PALETTE_ID);
  return fallback?.colors ?? [];
}

export function isColorblindSafeChartPalette(id: string): boolean {
  return CHART_PALETTE_LOOKUP.get(id)?.colorblindSafe ?? false;
}

export function listChartPalettesByCategory(
  category: ChartPaletteCategory,
): readonly ChartPaletteDef[] {
  return CHART_PALETTE_DEFS.filter((def) => def.category === category);
}
