import { apiContract } from "@/lib/api";
import { assertContractOk } from "@/lib/apiContractError";
import { createModuleSetupConfigApi } from "@/lib/query/createModuleSetupConfigApi";
import {
  normalizeFacultyModulePreferences,
  normalizeFacultySettings,
  stripFacultyFieldConfigForPersist,
  type FacultyModulePreferences,
  type FacultySettings,
} from "@mms/shared";

const api = createModuleSetupConfigApi<FacultyModulePreferences>({
  fetchPreferencesFn: async (_signal) => {
    const res = await apiContract.faculty.getPreferences({ query: undefined, extraHeaders: {} });
    assertContractOk(res, "Failed to load faculty preferences");
    return (res.body as { preferences: FacultyModulePreferences }).preferences;
  },
  savePreferencesFn: async (prefs) => {
    const res = await apiContract.faculty.updatePreferences({ body: prefs });
    assertContractOk(res, "Failed to save faculty preferences");
    return (res.body as { preferences: FacultyModulePreferences }).preferences;
  },
  normalizePrefs: (prefs: unknown) =>
    normalizeFacultyModulePreferences(prefs as Partial<FacultyModulePreferences>),
});

export const setFacultyPreferencesMemory = api.setPreferencesMemory;
export const fetchFacultyPreferences = api.fetchPreferences;
export const saveFacultyPreferencesAsync = api.savePreferencesAsync;

export async function fetchFacultyFieldConfig(_signal?: AbortSignal): Promise<FacultySettings> {
  const response = await apiContract.faculty.getFieldConfig({
    query: {},
    params: {},
    extraHeaders: {},
  });
  assertContractOk(response, "Failed to load faculty field configuration");
  const data = response.body as { config: FacultySettings | null };
  return normalizeFacultySettings(data?.config ?? null);
}

export async function saveFacultyFieldConfigAsync(
  config: FacultySettings,
): Promise<FacultySettings> {
  const bodyPayload = stripFacultyFieldConfigForPersist(config);
  const response = await apiContract.faculty.updateFieldConfig({ body: bodyPayload });
  assertContractOk(response, "Failed to save faculty field configuration");
  const data = response.body as { success: boolean; config: FacultySettings };
  return normalizeFacultySettings({
    ...(data?.config ?? bodyPayload),
    formTabs: data?.config?.formTabs ?? config.formTabs,
  });
}
