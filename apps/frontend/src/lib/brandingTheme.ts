import { type BrandingSettings, type BrandingThemeMode, type GlobalSettings } from "@mms/shared";
import { getScopedBrandingSettings, getScopedGlobalSettings } from "@/lib/settingsPreviewStore";
import { isEntryPath } from "@/lib/config/routes";
import {
  isTenantHost,
  MMS_PLATFORM_BRANDING,
  MMS_PLATFORM_GLOBAL_SETTINGS,
} from "@/platform/lib/themeScope";
import {
  applyBrandingFromSettings,
  applyDocumentLanguageWithFonts,
  resolveThemeMode,
} from "@/lib/brandingThemeCore";

import { applyApexPlatformTheme } from "@/platform/lib/brandingEntryTheme";
export { applyApexPlatformTheme } from "@/platform/lib/brandingEntryTheme";
export { applyTenantEntryTheme } from "@/tenant/lib/brandingEntryTheme";

function resolveTenantDocumentLanguage(storedLanguage: string, pathname: string): string {
  // Tenant auth entry stays English; authenticated app uses workspace language.
  return isEntryPath(pathname, { isApex: false }) ? "en" : storedLanguage;
}

/**
 * Applies branding colours to CSS variables.
 * Apex host: MMS platform defaults only. Tenant host: institution branding.
 */
export function applyBrandingTheme(
  branding?: Partial<Pick<BrandingSettings, "primaryColor" | "secondaryColor" | "cornerStyle">>,
  mode?: BrandingThemeMode,
): void {
  if (!isTenantHost()) {
    const activeMode = mode ?? resolveThemeMode(MMS_PLATFORM_GLOBAL_SETTINGS);
    const merged = branding ? { ...MMS_PLATFORM_BRANDING, ...branding } : MMS_PLATFORM_BRANDING;
    applyBrandingFromSettings(merged, activeMode);
    return;
  }

  const settings = getScopedGlobalSettings();
  const activeMode = mode ?? resolveThemeMode(settings);
  const scoped = getScopedBrandingSettings();
  const merged = branding ? { ...scoped, ...branding } : scoped;

  applyBrandingFromSettings(merged, activeMode);
}

export type AppThemeOverrides = Partial<Pick<GlobalSettings, "theme" | "language">>;

/**
 * Applies global theme class plus branding tokens for the active host scope.
 * Apex (platform) is always English + MMS platform branding.
 */
export function applyAppTheme(pathname?: string, overrides?: AppThemeOverrides): void {
  const activePath = pathname ?? (typeof window !== "undefined" ? window.location.pathname : "/");

  if (!isTenantHost()) {
    applyApexPlatformTheme("en");
    return;
  }

  const base = getScopedGlobalSettings();
  const settings = { ...base, ...overrides };
  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const activeTheme = settings.theme === "system" ? systemTheme : settings.theme;

  if (activeTheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  applyDocumentLanguageWithFonts(resolveTenantDocumentLanguage(settings.language, activePath));

  applyBrandingTheme(undefined, activeTheme);
}
