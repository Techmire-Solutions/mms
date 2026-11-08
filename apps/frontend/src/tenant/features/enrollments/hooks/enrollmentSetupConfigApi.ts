import { apiContract } from "@/lib/api";
import { createModuleSetupConfigApi } from "@/lib/query/createModuleSetupConfigApi";
import type { EnrollmentModulePreferences } from "@mms/shared";
import {
  enrollmentPreferencesResponseSchema,
  normalizeEnrollmentModulePreferences,
} from "@mms/shared";

const api = createModuleSetupConfigApi<EnrollmentModulePreferences>({
  fetchPreferencesFn: async (_signal) => {
    const res = await apiContract.enrollments.getPreferences({
      query: undefined,
      extraHeaders: {},
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
