import { apiContract } from "@mms/fe-core/api/tsRest";
import { createModuleSetupConfigApi } from "@mms/fe-core/query/createModuleSetupConfigApi";
import type { FinanceModulePreferences } from "@mms/contracts";
import { normalizeFinanceModulePreferences } from "@mms/contracts";

const api = createModuleSetupConfigApi<FinanceModulePreferences>({
  fetchPreferencesFn: async (signal) => {
    const res = await apiContract.finance.getPreferences({
      query: undefined,
      extraHeaders: {},
      signal,
      fetchOptions: { signal },
    });
    return (res.body as { preferences: FinanceModulePreferences }).preferences;
  },
  savePreferencesFn: async (prefs) => {
    const res = await apiContract.finance.updatePreferences({ body: prefs });
    return (res.body as { preferences: FinanceModulePreferences }).preferences;
  },
  normalizePrefs: normalizeFinanceModulePreferences as (prefs: unknown) => FinanceModulePreferences,
});

export const setFinancePreferencesMemory = api.setPreferencesMemory;
export const fetchFinancePreferences = api.fetchPreferences;
export const saveFinancePreferencesAsync = api.savePreferencesAsync;
export const getFinanceSettingsMemoryFallback = api.getSettingsMemoryFallback;
