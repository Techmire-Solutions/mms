import { DEFAULT_BRANDING_SETTINGS } from "@mms/contracts";
import { PRINT_COLORS, PRINT_NEUTRAL_PALETTE } from "./printTemplateStyles";

/** Neutral print-canvas colours (not institution-specific). */
export const PRINT_NEUTRAL = PRINT_NEUTRAL_PALETTE;

export interface PrintBrandingTokens {
  primary: string;
  secondary: string;
  destructive: string;
  onPrimary: string;
  logoPlaceholderBg: string;
  logoPlaceholderBorder: string;
  fieldPlaceholderBg: string;
  fieldPlaceholderBorder: string;
  text: string;
  muted: string;
  border: string;
  placeholder: string;
  paper: string;
}

/** Institution branding supplied by the app shell through a registered resolver. */
export interface PrintBrandingResolverResult {
  primaryColor?: string;
  secondaryColor?: string;
  destructive?: string;
}

let resolveBranding = (): PrintBrandingResolverResult => ({});

/**
 * Registers how print surfaces resolve the active institution branding.
 * The app shell calls this once at startup; without it, contract defaults are used.
 */
export function configurePrintBrandingResolver(resolver: () => PrintBrandingResolverResult): void {
  resolveBranding = resolver;
}

function hexWithAlpha(hex: string, alpha: number): string {
  let hexValue = hex.replace("#", "").trim();
  if (hexValue.length === 3)
    hexValue = hexValue
      .split("")
      .map((hexDigit) => hexDigit + hexDigit)
      .join("");
  const red = parseInt(hexValue.slice(0, 2), 16);
  const green = parseInt(hexValue.slice(2, 4), 16);
  const blue = parseInt(hexValue.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

/** Brand-derived hex tokens for invoice/certificate print canvases (inline styles). */
export function getPrintBrandingTokens(): PrintBrandingTokens {
  const branded = resolveBranding();
  const primary = branded.primaryColor || DEFAULT_BRANDING_SETTINGS.primaryColor;
  const secondary = branded.secondaryColor || DEFAULT_BRANDING_SETTINGS.secondaryColor;

  return {
    primary,
    secondary,
    destructive: branded.destructive || primary,
    onPrimary: PRINT_COLORS.white,
    logoPlaceholderBg: hexWithAlpha(primary, 0.06),
    logoPlaceholderBorder: hexWithAlpha(primary, 0.2),
    fieldPlaceholderBg: hexWithAlpha(primary, 0.04),
    fieldPlaceholderBorder: hexWithAlpha(primary, 0.25),
    ...PRINT_NEUTRAL,
  };
}
