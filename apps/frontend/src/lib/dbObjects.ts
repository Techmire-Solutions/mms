import {
  type BrandingSettings,
  type FinanceSettings,
  type GlobalSettings,
  type PublicBranding,
  DEFAULT_BRANDING_SETTINGS,
  DEFAULT_FINANCE_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS,
  mergeBrandingSettings,
  mergeGlobalSettings,
  registerFinanceCurrencyProvider,
  registerSettingsProvider,
} from "@mms/shared";
import { syncToServer, type ServerSyncResult } from "@/lib/dbStorageCore";
import { getObject, readObjectLocal, writeObjectLocal } from "@/lib/dbObjectStorage";
import { reportClientError } from "@/lib/clientErrorReporting";

export { getObject, readObjectLocal };

/** Reads `global_settings` merged with defaults (incl. all `enabledModules` keys). */
export function getGlobalSettings(): GlobalSettings {
  return mergeGlobalSettings(getObject<GlobalSettings>("global_settings", DEFAULT_GLOBAL_SETTINGS));
}

let globalSettingsPreview: Partial<GlobalSettings> | null = null;

/** Merges a live-preview patch (Settings panels) without persisting. */
export function mergeGlobalSettingsPreview(patch: Partial<GlobalSettings> | null): void {
  if (patch === null) {
    globalSettingsPreview = null;
    return;
  }
  globalSettingsPreview = {
    ...globalSettingsPreview,
    ...patch,
    ...(patch.enabledModules
      ? { enabledModules: { ...globalSettingsPreview?.enabledModules, ...patch.enabledModules } }
      : {}),
  };
}

/** Clears the in-memory global settings preview overlay. */
export function clearGlobalSettingsPreviewOverlay(): void {
  globalSettingsPreview = null;
}

/** Persisted `global_settings` merged with any active preview overlay. */
export function getEffectiveGlobalSettings(): GlobalSettings {
  return mergeGlobalSettings({
    ...getGlobalSettings(),
    ...(globalSettingsPreview ?? {}),
  });
}

registerSettingsProvider(() => {
  const settings = getEffectiveGlobalSettings();
  return {
    dateFormat: settings.dateFormat,
    timezone: settings.timezone,
    language: settings.language,
  };
});

registerFinanceCurrencyProvider(
  () => getObject<FinanceSettings>("finance_settings", DEFAULT_FINANCE_SETTINGS).currency,
);

/** Persists merged global settings and dispatches `local-database-update`. */
export function saveGlobalSettings(globalSettings: GlobalSettings): void {
  saveObject("global_settings", mergeGlobalSettings(globalSettings));
}

/** Persists global settings locally and waits for PostgreSQL sync. */
export async function saveGlobalSettingsAsync(
  globalSettings: GlobalSettings,
): Promise<ServerSyncResult> {
  const merged = mergeGlobalSettings(globalSettings);
  try {
    const processed = writeObjectLocal("global_settings", merged);
    return await syncToServer("/api/db/objects/global_settings", processed);
  } catch (error) {
    reportClientError(error, { context: "db.saveGlobalSettings" });
    return { ok: false };
  }
}

/** Reads `branding` merged with defaults. */
export function getBrandingSettings(): BrandingSettings {
  return mergeBrandingSettings(getObject<BrandingSettings>("branding", DEFAULT_BRANDING_SETTINGS));
}

let brandingPreview: Partial<BrandingSettings> | null = null;

/** Merges a live-preview patch (Settings panels) without persisting. */
export function mergeBrandingSettingsPreview(patch: Partial<BrandingSettings> | null): void {
  brandingPreview = patch === null ? null : { ...brandingPreview, ...patch };
}

/** Clears the in-memory branding preview overlay. */
export function clearBrandingSettingsPreviewOverlay(): void {
  brandingPreview = null;
}

/** Persisted `branding` merged with any active preview overlay. */
export function getEffectiveBrandingSettings(): BrandingSettings {
  return mergeBrandingSettings({
    ...getBrandingSettings(),
    ...(brandingPreview ?? {}),
  });
}

/** Persists merged branding locally and waits for PostgreSQL sync to complete. */
export async function saveBrandingSettings(
  brandingSettings: BrandingSettings,
): Promise<ServerSyncResult> {
  const merged = mergeBrandingSettings(brandingSettings);
  try {
    const processed = writeObjectLocal("branding", merged);
    return await syncToServer("/api/db/objects/branding", processed);
  } catch (error) {
    reportClientError(error, { context: "db.saveBrandingSettings" });
    return { ok: false };
  }
}

/** Merges public branding from the workspace API into the local branding object (login prefetch). */
export function cachePublicBranding(partial: PublicBranding): void {
  const existing = mergeBrandingSettings(
    readObjectLocal<BrandingSettings>("branding") ?? DEFAULT_BRANDING_SETTINGS,
  );
  writeObjectLocal("branding", mergeBrandingSettings({ ...existing, ...partial }));
}

export function saveObject<T>(key: string, objectValue: T): void {
  try {
    const processed = writeObjectLocal(key, objectValue);
    void syncToServer(`/api/db/objects/${key}`, processed);
  } catch (error) {
    reportClientError(error, { context: "db.saveObject", key });
  }
}

/** Persists an object locally and waits for PostgreSQL sync. */
export async function saveObjectAsync<T>(key: string, objectValue: T): Promise<ServerSyncResult> {
  try {
    const processed = writeObjectLocal(key, objectValue);
    return await syncToServer(`/api/db/objects/${key}`, processed);
  } catch (error) {
    reportClientError(error, { context: "db.saveObjectAsync", key });
    return { ok: false };
  }
}
