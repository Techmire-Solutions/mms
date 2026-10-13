import {
  BRANDING_FOOTER_MAX,
  BRANDING_NAME_MAX,
  formatBrandingFooterDefault,
  IMAGE_UPLOAD_MAX_INPUT_BYTES,
  IMAGE_UPLOAD_PRESETS,
  mergeBrandingSettings,
  type BrandingSettings,
} from "@mms/shared";
import { saveBrandingSettings } from "@/lib/db";
import { getScopedBrandingSettings } from "@/lib/settingsPreviewStore";
import { reportClientError } from "@/lib/clientErrorReporting";

export const MAX_FILE_BYTES = IMAGE_UPLOAD_MAX_INPUT_BYTES;
export const NAME_MAX = BRANDING_NAME_MAX;
export const TAGLINE_MAX = 80;
export const FOOTER_MAX = BRANDING_FOOTER_MAX;

/** @deprecated Use IMAGE_UPLOAD_PRESETS.logo */
export const LOGO_OPTIMIZE_OPTIONS = IMAGE_UPLOAD_PRESETS.logo;
/** @deprecated Use IMAGE_UPLOAD_PRESETS.favicon */
export const FAVICON_OPTIMIZE_OPTIONS = IMAGE_UPLOAD_PRESETS.favicon;

export function loadBranding(): BrandingSettings {
  try {
    const rawLegacy = localStorage.getItem("madrasa_branding");
    if (rawLegacy) {
      const migrated = mergeBrandingSettings(JSON.parse(rawLegacy) as Partial<BrandingSettings>);
      void saveBrandingSettings(migrated);
      localStorage.removeItem("madrasa_branding");
      return migrated;
    }
  } catch (error) {
    reportClientError(error, { context: "branding.migrateLegacyKey" });
  }

  return getScopedBrandingSettings();
}

export { FieldHint } from "@/components/branding/BrandingFieldHint";
export { ImageUploadField } from "@/components/branding/BrandingImageUploadField";
export { SocialLinksEditor } from "@/components/branding/BrandingSocialLinksEditor";
export { SettingsStatusBadges } from "@/components/app/SettingsShell";

export function defaultFooterForMadrasa(madrasaName: string, language = "en"): string {
  return formatBrandingFooterDefault(madrasaName, language);
}
