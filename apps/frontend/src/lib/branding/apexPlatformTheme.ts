import { applyDocumentTheme } from "@/lib/brandingThemeCore";
import {
  getEffectivePlatformThemeMode,
  getPlatformBrandingAsBrandingSettings,
} from "@/lib/branding/platformBrandingStore";

/** Applies the instance's white-label branding + saved display mode to the apex document. */
export function applyApexPlatformTheme(language = "en"): void {
  applyDocumentTheme(
    getPlatformBrandingAsBrandingSettings(),
    getEffectivePlatformThemeMode(),
    language,
  );
}
