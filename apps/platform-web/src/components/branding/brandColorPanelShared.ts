import {
  brandingTokenToHex,
  buildBrandingCssVariables,
  getContrastRatio,
  type resolveBrandingChartPaletteHex,
  type AppTranslationKey,
  type BrandingThemeMode,
} from "@mms/contracts";

export type BrandingTokens = ReturnType<typeof buildBrandingCssVariables>;

export const DERIVED_SWATCHES: { labelKey: AppTranslationKey; token: keyof BrandingTokens }[] = [
  { labelKey: "theme.tokenPrimary", token: "--primary" },
  { labelKey: "theme.tokenAccent", token: "--secondary" },
  { labelKey: "theme.tokenMuted", token: "--muted" },
  { labelKey: "theme.tokenBorder", token: "--border" },
  { labelKey: "theme.tokenSuccess", token: "--success" },
  { labelKey: "theme.tokenChart1", token: "--chart-1" },
  { labelKey: "theme.tokenChart2", token: "--chart-2" },
  { labelKey: "theme.tokenSidebar", token: "--sidebar-background" },
];

const CUSTOM_PRESETS_STORAGE_KEY = "mms_custom_theme_presets";

export interface CustomThemePreset {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
}

export function loadCustomPresets(): CustomThemePreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomThemePreset[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomPresets(presets: CustomThemePreset[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // ignore
  }
}

export function presetPrimaryContrast(
  primaryHex: string,
  secondaryHex: string,
  previewMode: BrandingThemeMode,
): number | null {
  const tokens = buildBrandingCssVariables(primaryHex, secondaryHex, previewMode);
  const bgHex = brandingTokenToHex(tokens["--primary"] ?? "");
  const fgHex = brandingTokenToHex(tokens["--primary-foreground"] ?? "");
  return getContrastRatio(fgHex, bgHex);
}

export interface BrandSemanticPreviewContext {
  activeOnPrimaryBg: string;
  activeOnPrimaryFg: string;
  activeOnSecondaryBg: string;
  activeOnSecondaryFg: string;
  activeTokens: BrandingTokens;
  chartPalette: ReturnType<typeof resolveBrandingChartPaletteHex>;
}
