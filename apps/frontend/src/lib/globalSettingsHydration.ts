import { DEFAULT_GLOBAL_SETTINGS, mergeGlobalSettings, type GlobalSettings } from "@mms/shared";
import { apiFetch } from "@/lib/apiClient";
import { getObject, writeObjectLocal } from "@/lib/dbObjectStorage";

const LOCALIZATION_KEYS = ["language", "timezone", "dateFormat"] as const;

export function mergeServerLocalization(
  current: GlobalSettings,
  server: Partial<GlobalSettings> | null,
): GlobalSettings {
  if (!server) return current;
  const patch: Partial<GlobalSettings> = {};
  for (const key of LOCALIZATION_KEYS) {
    const value = server[key];
    if (typeof value === "string" && value.trim()) {
      (patch as Record<string, string>)[key] = value;
    }
  }
  return mergeGlobalSettings({ ...current, ...patch });
}

/**
 * Reads the persisted `global_settings` object from PostgreSQL and copies only
 * localization fields into the device-local store. Called once per authenticated
 * tenant boot; local storage remains the editing source afterwards.
 */
export async function hydrateGlobalSettingsFromServer(): Promise<void> {
  const response = await apiFetch("/api/db/objects/global_settings");
  if (!response.ok) return;
  const server = (await response.json()) as Partial<GlobalSettings> | null;
  const current = getObject<GlobalSettings>("global_settings", DEFAULT_GLOBAL_SETTINGS);
  const merged = mergeServerLocalization(current, server);
  if (JSON.stringify(merged) !== JSON.stringify(current)) {
    writeObjectLocal("global_settings", merged);
  }
}
