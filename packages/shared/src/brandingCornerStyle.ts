import type { AppTranslationKey } from "./appTranslations.js";

/** Tenant-selectable UI corner roundness — maps to CSS `--radius`. */
export const BRANDING_CORNER_STYLE_VALUES = ["sharp", "subtle", "rounded", "soft"] as const;

export type BrandingCornerPreset = (typeof BRANDING_CORNER_STYLE_VALUES)[number];

export type BrandingCornerStyle = string;

export const DEFAULT_BRANDING_CORNER_STYLE: BrandingCornerStyle = "rounded";

/** Base `--radius` token per style (drives `rounded-*` across shadcn/Tailwind). */
export const BRANDING_CORNER_RADIUS: Record<BrandingCornerPreset, string> = {
  sharp: "0.125rem",
  subtle: "0.375rem",
  rounded: "0.625rem",
  soft: "1rem",
};

export interface BrandingCornerStyleOption {
  value: BrandingCornerPreset;
  labelKey: AppTranslationKey;
  descriptionKey: AppTranslationKey;
}

export const BRANDING_CORNER_STYLE_OPTIONS: readonly BrandingCornerStyleOption[] = [
  {
    value: "sharp",
    labelKey: "theme.cornerSharp",
    descriptionKey: "theme.cornerSharpDesc",
  },
  {
    value: "subtle",
    labelKey: "theme.cornerSubtle",
    descriptionKey: "theme.cornerSubtleDesc",
  },
  {
    value: "rounded",
    labelKey: "theme.cornerRounded",
    descriptionKey: "theme.cornerRoundedDesc",
  },
  {
    value: "soft",
    labelKey: "theme.cornerSoft",
    descriptionKey: "theme.cornerSoftDesc",
  },
] as const;

const BRANDING_CORNER_STYLE_VALUES_SET = new Set<string>(BRANDING_CORNER_STYLE_VALUES);

/**
 * Coerces stored branding values to a supported corner style.
 */
export function normalizeBrandingCornerStyle(value: unknown): BrandingCornerStyle {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (BRANDING_CORNER_STYLE_VALUES_SET.has(trimmed)) {
      return trimmed;
    }
    if (/^\d+(\.\d+)?(px|rem|em|%)?$/.test(trimmed)) {
      return trimmed;
    }
  }
  return DEFAULT_BRANDING_CORNER_STYLE;
}

/** Resolves the CSS length for `--radius`. */
export function resolveBrandingCornerRadius(style: BrandingCornerStyle): string {
  if (style in BRANDING_CORNER_RADIUS) {
    return BRANDING_CORNER_RADIUS[style as BrandingCornerPreset];
  }
  if (/^\d+(\.\d+)?$/.test(style)) {
    return `${style}px`;
  }
  return style;
}

/** Translation key for the active corner style label. */
export function cornerStyleLabelKey(style: BrandingCornerStyle): AppTranslationKey {
  const found = BRANDING_CORNER_STYLE_OPTIONS.find((option) => option.value === style);
  return found ? found.labelKey : "theme.cornerCustom";
}
