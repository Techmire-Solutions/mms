import { normalizeFinanceModulePreferences, type FinanceModulePreferences } from "@mms/shared";
import { createModuleSetupConfigApi } from "@/lib/query/createModuleSetupConfigApi";

export const financeSetupConfigApi = createModuleSetupConfigApi<FinanceModulePreferences>({
  fetchPreferencesFn: async () => {
    // Implement fetch
    return normalizeFinanceModulePreferences(null);
  },
  savePreferencesFn: async (prefs) => {
    // Implement save
    return prefs as FinanceModulePreferences;
  },
  normalizePrefs: (prefs: unknown) =>
    normalizeFinanceModulePreferences(prefs as Record<string, unknown>),
});

export const fetchFinancePreferences = financeSetupConfigApi.fetchPreferences;
export const saveFinancePreferencesAsync = financeSetupConfigApi.savePreferencesAsync;
export const setFinancePreferencesMemory = financeSetupConfigApi.setPreferencesMemory;
