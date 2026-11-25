import {
  DEFAULT_BRANDING_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS,
  mergeBrandingSettings,
  type PublicBranding,
} from "@mms/contracts";
import { applyDocumentTheme } from "./brandingThemeCore.js";

export function applyTenantEntryTheme(branding: PublicBranding): void {
  applyDocumentTheme(
    mergeBrandingSettings({ ...DEFAULT_BRANDING_SETTINGS, ...branding }),
    DEFAULT_GLOBAL_SETTINGS.theme,
    "en",
  );
}
