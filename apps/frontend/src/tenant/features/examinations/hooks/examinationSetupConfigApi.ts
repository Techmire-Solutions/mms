import { apiContract } from "@/lib/api";
import { createModuleSetupConfigApi } from "@/lib/query/createModuleSetupConfigApi";
import type { ExaminationsModulePreferences } from "@mms/shared";
import { normalizeExaminationsModulePreferences } from "@mms/shared";

const api = createModuleSetupConfigApi<ExaminationsModulePreferences>({
  fetchPreferencesFn: async (_signal) => {
    const res = await apiContract.examinations.getPreferences({
      query: undefined,
      extraHeaders: {},
    });
    return (res.body as { preferences: ExaminationsModulePreferences }).preferences;
  },
  savePreferencesFn: async (prefs) => {
    const res = await apiContract.examinations.updatePreferences({ body: prefs });
    return (res.body as { preferences: ExaminationsModulePreferences }).preferences;
  },
  normalizePrefs: normalizeExaminationsModulePreferences as (
    prefs: unknown,
  ) => ExaminationsModulePreferences,
});

export const setExaminationPreferencesMemory = api.setPreferencesMemory;
export const fetchExaminationPreferences = api.fetchPreferences;
export const saveExaminationPreferencesAsync = api.savePreferencesAsync;
export const getExaminationSettingsMemoryFallback = api.getSettingsMemoryFallback;
