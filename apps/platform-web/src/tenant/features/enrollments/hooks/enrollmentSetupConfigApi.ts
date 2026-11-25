import { apiContract } from "@mms/fe-core/api/tsRest";
import { createModuleSetupConfigApi } from "@mms/fe-core/query/createModuleSetupConfigApi";
import type { EnrollmentModulePreferences } from "@mms/contracts";
import {
  enrollmentPreferencesResponseSchema,
  normalizeEnrollmentModulePreferences,
} from "@mms/contracts";

const api = createModuleSetupConfigApi<EnrollmentModulePreferences>({
  fetchPreferencesFn: async (signal) => {
    const res = await apiContract.enrollments.getPreferences({
      query: undefined,
      extraHeaders: {},
      fetchOptions: { signal },
    });
    const body = res.body as { preferences?: unknown } | null;
    return enrollmentPreferencesResponseSchema.parse(body?.preferences);
  },
  savePreferencesFn: async (prefs) => {
    const res = await apiContract.enrollments.updatePreferences({ body: prefs });
    const body = res.body as { preferences?: unknown } | null;
    return enrollmentPreferencesResponseSchema.parse(body?.preferences);
  },
  normalizePrefs: normalizeEnrollmentModulePreferences as (
    prefs: unknown,
  ) => EnrollmentModulePreferences,
});

export const setEnrollmentPreferencesMemory = api.setPreferencesMemory;
export const fetchEnrollmentPreferences = api.fetchPreferences;
export const saveEnrollmentPreferencesAsync = api.savePreferencesAsync;
export const getEnrollmentSettingsMemoryFallback = api.getSettingsMemoryFallback;
