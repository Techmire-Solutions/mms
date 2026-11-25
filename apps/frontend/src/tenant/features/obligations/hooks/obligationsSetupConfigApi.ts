import { apiContract } from "@/lib/api";
import { createModuleSetupConfigApi } from "@/lib/query/createModuleSetupConfigApi";
import type { ObligationsModulePreferences } from "@mms/contracts";
import { normalizeObligationsModulePreferences } from "@mms/contracts";

const api = createModuleSetupConfigApi<ObligationsModulePreferences>({
  fetchPreferencesFn: async (signal) => {
    const res = await apiContract.obligations.getPreferences({
      query: undefined,
      extraHeaders: {},
      signal,
      fetchOptions: { signal },
    });
    return (res.body as { preferences: ObligationsModulePreferences }).preferences;
  },
  savePreferencesFn: async (prefs) => {
    const res = await apiContract.obligations.updatePreferences({ body: prefs });
    return (res.body as { preferences: ObligationsModulePreferences }).preferences;
  },
  normalizePrefs: normalizeObligationsModulePreferences as (
    prefs: unknown,
  ) => ObligationsModulePreferences,
});

export const setObligationsPreferencesMemory = api.setPreferencesMemory;
export const fetchObligationsPreferences = api.fetchPreferences;
export const saveObligationsPreferencesAsync = api.savePreferencesAsync;
export const getObligationsSettingsMemoryFallback = api.getSettingsMemoryFallback;
