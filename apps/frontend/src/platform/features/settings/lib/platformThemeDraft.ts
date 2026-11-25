import { normalizeBrandingCornerStyle, normalizeThemeMode, type ThemeMode } from "@mms/contracts";

export interface PlatformThemeDraft {
  themeMode: ThemeMode;
  primaryColor: string;
  secondaryColor: string;
  cornerStyle: string;
  footerText: string;
}

export function toPlatformThemeDraft(
  themeMode: ThemeMode,
  branding: {
    primaryColor: string;
    secondaryColor: string;
    cornerStyle: string;
    footerText: string;
  },
): PlatformThemeDraft {
  return {
    themeMode: normalizeThemeMode(themeMode),
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    cornerStyle: normalizeBrandingCornerStyle(branding.cornerStyle),
    footerText: branding.footerText,
  };
}
