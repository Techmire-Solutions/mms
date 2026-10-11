import { type BrandingSettings, type GlobalSettings } from "@mms/shared";
import {
  clearBrandingSettingsPreviewOverlay,
  clearGlobalSettingsPreviewOverlay,
  getEffectiveBrandingSettings,
  getEffectiveGlobalSettings,
  mergeBrandingSettingsPreview,
  mergeGlobalSettingsPreview,
} from "@/lib/dbObjects.js";
import {
  isTenantHost,
  MMS_PLATFORM_BRANDING,
  MMS_PLATFORM_GLOBAL_SETTINGS,
} from "@/platform/lib/themeScope";

/** Tenant-persisted global settings + preview overlay (apex returns MMS platform defaults). */
export function getEffectiveGlobalSettingsScoped(): GlobalSettings {
  if (!isTenantHost()) return MMS_PLATFORM_GLOBAL_SETTINGS;
  return getEffectiveGlobalSettings();
}

/** Tenant-persisted branding + preview overlay (apex returns MMS platform defaults). */
export function getEffectiveBrandingSettingsScoped(): BrandingSettings {
  if (!isTenantHost()) return MMS_PLATFORM_BRANDING;
  return getEffectiveBrandingSettings();
}

/** Settings used for theme injection — same as effective on tenant; MMS defaults on apex. */
export function getScopedGlobalSettings(): GlobalSettings {
  return getEffectiveGlobalSettingsScoped();
}

/** Branding used for theme injection — institution on tenant; MMS defaults on apex. */
export function getScopedBrandingSettings(): BrandingSettings {
  return getEffectiveBrandingSettingsScoped();
}

export function setGlobalPreview(patch: Partial<GlobalSettings> | null): void {
  mergeGlobalSettingsPreview(patch);
}

export function setBrandingPreview(patch: Partial<BrandingSettings> | null): void {
  mergeBrandingSettingsPreview(patch);
}

export function clearGlobalPreview(): void {
  clearGlobalSettingsPreviewOverlay();
}

export function clearBrandingPreview(): void {
  clearBrandingSettingsPreviewOverlay();
}

export function clearAllPreviews(): void {
  clearGlobalSettingsPreviewOverlay();
  clearBrandingSettingsPreviewOverlay();
}
