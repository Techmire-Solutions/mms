import { mergeGlobalSettings, type BrandingSettings, type GlobalSettings } from "@mms/contracts";
import {
  clearBrandingSettingsPreviewOverlay,
  clearGlobalSettingsPreviewOverlay,
  getEffectiveBrandingSettings,
  getEffectiveGlobalSettings,
  mergeBrandingSettingsPreview,
  mergeGlobalSettingsPreview,
} from "./dbObjects.js";
import {
  getEffectivePlatformThemeMode,
  getPlatformBrandingAsBrandingSettings,
  getPlatformRegionalSettings,
} from "./platformBrandingStore.js";
import { isTenantHost } from "../config/tenantConfig.js";

/** Tenant-persisted global settings + preview overlay (apex returns platform instance defaults). */
export function getEffectiveGlobalSettingsScoped(): GlobalSettings {
  if (!isTenantHost()) {
    const regional = getPlatformRegionalSettings();
    return mergeGlobalSettings({
      language: "en",
      timezone: regional.timezone,
      dateFormat: regional.dateFormat,
      theme: getEffectivePlatformThemeMode(),
    });
  }
  return getEffectiveGlobalSettings();
}

/** Tenant-persisted branding + preview overlay (apex returns platform white-label branding). */
export function getEffectiveBrandingSettingsScoped(): BrandingSettings {
  if (!isTenantHost()) return getPlatformBrandingAsBrandingSettings();
  return getEffectiveBrandingSettings();
}

/** Settings used for theme injection — same as effective on tenant; platform branding on apex. */
export function getScopedGlobalSettings(): GlobalSettings {
  return getEffectiveGlobalSettingsScoped();
}

/** Branding used for theme injection — institution on tenant; platform brand on apex. */
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
