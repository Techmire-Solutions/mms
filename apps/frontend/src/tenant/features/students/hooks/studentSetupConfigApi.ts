import { apiContract } from "@/lib/api";
import { assertContractOk } from "@/lib/apiContractError";
import { createModuleSetupConfigApi } from "@/lib/query/createModuleSetupConfigApi";
import {
  normalizeStudentModulePreferences,
  normalizeStudentsSettings,
  stripStudentFieldConfigForPersist,
  type StudentModulePreferences,
  type StudentsSettings,
} from "@mms/contracts";

const api = createModuleSetupConfigApi<StudentModulePreferences>({
  fetchPreferencesFn: async (signal) => {
    const res = await apiContract.students.getPreferences({
      query: undefined,
      extraHeaders: {},
      signal,
      fetchOptions: { signal },
    });
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

/** GET /api/students/field-config — composed settings, or seed defaults when never saved. */
export async function fetchStudentFieldConfig(signal?: AbortSignal): Promise<StudentsSettings> {
  const response = await apiContract.students.getFieldConfig({
    extraHeaders: {},
    signal,
    fetchOptions: { signal },
  });
  assertContractOk(response, "Failed to load student field configuration");
  const body = response.body as { config: Record<string, unknown> | null };
  return normalizeStudentsSettings(body?.config ?? null);
}

/** PUT /api/students/field-config — persists the field registry slice (never prefs / tabs). */
export async function saveStudentFieldConfigAsync(
  config: StudentsSettings,
): Promise<StudentsSettings> {
  const bodyPayload = stripStudentFieldConfigForPersist(config);
  const response = await apiContract.students.updateFieldConfig({ body: bodyPayload });
  assertContractOk(response, "Failed to save student field configuration");
  const body = response.body as { success: boolean; config: Record<string, unknown> };
  return normalizeStudentsSettings(body?.config ?? bodyPayload);
}
