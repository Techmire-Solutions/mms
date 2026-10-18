import {
  DEFAULT_BRANDING_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS,
  mergeBrandingSettings,
  type PublicBranding,
} from "@mms/shared";
import { applyDocumentTheme } from "@/lib/brandingThemeCore";

export function applyTenantEntryTheme(branding: PublicBranding): void {
  applyDocumentTheme(
    mergeBrandingSettings({ ...DEFAULT_BRANDING_SETTINGS, ...branding }),
    DEFAULT_GLOBAL_SETTINGS.theme,
    "en",
  );
}
