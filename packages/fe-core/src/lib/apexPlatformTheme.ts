import { applyDocumentTheme } from "./brandingThemeCore.js";
import {
  getEffectivePlatformThemeMode,
  getPlatformBrandingAsBrandingSettings,
} from "./platformBrandingStore.js";

/** Applies the instance's white-label branding + saved display mode to the apex document. */
export function applyApexPlatformTheme(language = "en"): void {
  applyDocumentTheme(
    getPlatformBrandingAsBrandingSettings(),
    getEffectivePlatformThemeMode(),
    language,
  );
}
