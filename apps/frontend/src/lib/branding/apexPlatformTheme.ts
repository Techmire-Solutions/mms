import { applyDocumentTheme } from "@/lib/brandingThemeCore";
import { MMS_PLATFORM_BRANDING, MMS_PLATFORM_GLOBAL_SETTINGS } from "../../platform/lib/themeScope";

export function applyApexPlatformTheme(language = "en"): void {
  applyDocumentTheme(MMS_PLATFORM_BRANDING, MMS_PLATFORM_GLOBAL_SETTINGS.theme, language);
}
