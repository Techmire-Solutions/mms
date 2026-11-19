import { apiContract } from "@/lib/api";
import { createModuleSetupConfigApi } from "@/lib/query/createModuleSetupConfigApi";
import type { FinanceModulePreferences } from "@mms/shared";
import { normalizeFinanceModulePreferences } from "@mms/shared";

const api = createModuleSetupConfigApi<FinanceModulePreferences>({
  fetchPreferencesFn: async (_signal) => {
    const res = await apiContract.finance.getPreferences({
      query: undefined,
      extraHeaders: {},
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
