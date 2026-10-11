import type { BrandingSettings, GlobalSettings } from "@mms/shared";
import { applyAppTheme, applyBrandingTheme } from "@/lib/brandingTheme";
import {
  clearAllPreviews,
  clearBrandingPreview,
  clearGlobalPreview,
  getEffectiveBrandingSettingsScoped,
  getEffectiveGlobalSettingsScoped,
  setBrandingPreview,
  setGlobalPreview,
} from "@/lib/settingsPreviewStore";
import { isTenantHost } from "@/platform/lib/themeScope";

export {
  getEffectiveGlobalSettingsScoped as getEffectiveGlobalSettings,
  getEffectiveBrandingSettingsScoped as getEffectiveBrandingSettings,
} from "@/lib/settingsPreviewStore";

export const SETTINGS_PREVIEW_EVENT = "settings-preview-update";

function dispatchPreviewUpdate(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SETTINGS_PREVIEW_EVENT));
}

function applyGlobalPreviewEffects(): void {
  const settings = getEffectiveGlobalSettingsScoped();
  applyAppTheme(undefined, { theme: settings.theme, language: settings.language });
  applyBrandingPreviewEffects();
}

function applyBrandingPreviewEffects(): void {
  const branding = getEffectiveBrandingSettingsScoped();
  applyBrandingTheme({
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    cornerStyle: branding.cornerStyle,
  });
}

/**
 * Live-preview global settings (theme, language, enabled modules) before Save.
 * Does not write to localStorage or PostgreSQL.
 */
export function previewGlobalSettings(patch: Partial<GlobalSettings>): void {
  if (!isTenantHost()) return;
  setGlobalPreview(patch);
  applyGlobalPreviewEffects();
  dispatchPreviewUpdate();
}

/**
 * Live-preview branding (colours, name, logo, etc.) before Save.
 */
export function previewBrandingSettings(patch: Partial<BrandingSettings>): void {
  if (!isTenantHost()) return;
  setBrandingPreview(patch);
  applyBrandingPreviewEffects();
  dispatchPreviewUpdate();
}

/** Drop preview overlays and re-apply persisted settings (e.g. leaving `/settings`). */
export function revertSettingsPreviews(): void {
  clearAllPreviews();
  applyAppTheme();
  dispatchPreviewUpdate();
}

export function clearGlobalSettingsPreview(): void {
  clearGlobalPreview();
  applyGlobalPreviewEffects();
  dispatchPreviewUpdate();
}

export function clearBrandingSettingsPreview(): void {
  clearBrandingPreview();
  applyBrandingPreviewEffects();
  dispatchPreviewUpdate();
}
