import { apiContract } from "@/lib/api";
import { createModuleSetupConfigApi } from "@/lib/query/createModuleSetupConfigApi";
import type { HasanatModulePreferences } from "@mms/shared";
import { normalizeHasanatModulePreferences } from "@mms/shared";

const api = createModuleSetupConfigApi<HasanatModulePreferences>({
  fetchPreferencesFn: async (_signal) => {
    const res = await apiContract.hasanat.getPreferences({ query: undefined, extraHeaders: {} });
    return (res.body as { preferences: HasanatModulePreferences }).preferences;
  },
  savePreferencesFn: async (prefs) => {
    const res = await apiContract.hasanat.updatePreferences({ body: prefs });
    return (res.body as { preferences: HasanatModulePreferences }).preferences;
  },
  normalizePrefs: normalizeHasanatModulePreferences as (prefs: unknown) => HasanatModulePreferences,
});

export const setHasanatPreferencesMemory = api.setPreferencesMemory;
export const fetchHasanatPreferences = api.fetchPreferences;
export const saveHasanatPreferencesAsync = api.savePreferencesAsync;
export const getHasanatSettingsMemoryFallback = api.getSettingsMemoryFallback;
