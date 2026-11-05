import { apiContract } from "@/lib/api";
import { assertContractOk } from "@/lib/apiContractError";
import { createModuleSetupConfigApi } from "@/lib/query/createModuleSetupConfigApi";
import type { StudentModulePreferences } from "@mms/shared";
import { normalizeStudentModulePreferences } from "@mms/shared";

const api = createModuleSetupConfigApi<StudentModulePreferences>({
  fetchPreferencesFn: async (_signal) => {
    const res = await apiContract.students.getPreferences({ query: undefined, extraHeaders: {} });
    assertContractOk(res, "Failed to load student preferences");
    return (res.body as { preferences: StudentModulePreferences }).preferences;
  },
  savePreferencesFn: async (prefs) => {
    const res = await apiContract.students.updatePreferences({ body: prefs });
    assertContractOk(res, "Failed to save student preferences");
    return (res.body as { preferences: StudentModulePreferences }).preferences;
  },
  normalizePrefs: normalizeStudentModulePreferences as (prefs: unknown) => StudentModulePreferences,
});

export const setStudentPreferencesMemory = api.setPreferencesMemory;
export const fetchStudentPreferences = api.fetchPreferences;
export const saveStudentPreferencesAsync = api.savePreferencesAsync;
export const getStudentSettingsMemoryFallback = api.getSettingsMemoryFallback;
