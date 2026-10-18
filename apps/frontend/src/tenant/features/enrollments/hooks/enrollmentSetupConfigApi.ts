import { apiContract } from "@/lib/api";
import { createModuleSetupConfigApi } from "@/lib/query/createModuleSetupConfigApi";
import type { EnrollmentModulePreferences } from "@mms/shared";
import { normalizeEnrollmentModulePreferences } from "@mms/shared";

const api = createModuleSetupConfigApi<EnrollmentModulePreferences>({
  fetchPreferencesFn: async (_signal) => {
    const res = await apiContract.enrollments.getPreferences({
      query: undefined,
      extraHeaders: {},
    });
    return (res.body as { preferences: EnrollmentModulePreferences }).preferences;
  },
  savePreferencesFn: async (prefs) => {
    const res = await apiContract.enrollments.updatePreferences({ body: prefs });
    return (res.body as { preferences: EnrollmentModulePreferences }).preferences;
  },
  normalizePrefs: normalizeEnrollmentModulePreferences as (
    prefs: unknown,
  ) => EnrollmentModulePreferences,
});

export const setEnrollmentPreferencesMemory = api.setPreferencesMemory;
export const fetchEnrollmentPreferences = api.fetchPreferences;
export const saveEnrollmentPreferencesAsync = api.savePreferencesAsync;
export const getEnrollmentSettingsMemoryFallback = api.getSettingsMemoryFallback;
