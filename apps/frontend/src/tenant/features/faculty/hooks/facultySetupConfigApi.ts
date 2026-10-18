import { apiContract } from "@/lib/api";
import { createModuleSetupConfigApi } from "@/lib/query/createModuleSetupConfigApi";
import {
  composeFacultySettings,
  normalizeFacultyModulePreferences,
  normalizeFacultySettings,
  stripFacultyFieldConfigForPersist,
  type FacultyModulePreferences,
  type FacultySettings,
} from "@mms/shared";

const api = createModuleSetupConfigApi<FacultyModulePreferences>({
  fetchPreferencesFn: async (_signal) => {
    const res = await apiContract.faculty.getPreferences({ query: undefined, extraHeaders: {} });
    return (res.body as { preferences: FacultyModulePreferences }).preferences;
  },
  savePreferencesFn: async (prefs) => {
    const res = await apiContract.faculty.updatePreferences({ body: prefs });
    return (res.body as { preferences: FacultyModulePreferences }).preferences;
  },
  normalizePrefs: (prefs: unknown) =>
    normalizeFacultyModulePreferences(prefs as Partial<FacultyModulePreferences>),
});

export const setFacultyPreferencesMemory = api.setPreferencesMemory;
export const fetchFacultyPreferences = api.fetchPreferences;
export const saveFacultyPreferencesAsync = api.savePreferencesAsync;

let memoryFieldConfig: FacultySettings | null = null;

export function setFacultyFieldConfigMemory(config: FacultySettings): void {
  memoryFieldConfig = normalizeFacultySettings(config);
}

export async function fetchFacultyFieldConfig(_signal?: AbortSignal): Promise<FacultySettings> {
  const response = await apiContract.faculty.getFieldConfig({
    query: {},
    params: {},
    extraHeaders: {},
  });
  const data = response.body as { config: FacultySettings | null };
  const merged = normalizeFacultySettings(data?.config ?? null);
  memoryFieldConfig = merged;
  return merged;
}

export async function saveFacultyFieldConfigAsync(
  config: FacultySettings,
): Promise<FacultySettings> {
  const bodyPayload = stripFacultyFieldConfigForPersist(config);
  const response = await apiContract.faculty.updateFieldConfig({ body: bodyPayload });
  const data = response.body as { success: boolean; config: FacultySettings };
  const saved = normalizeFacultySettings({
    ...(data?.config ?? bodyPayload),
    formTabs: data?.config?.formTabs ?? config.formTabs,
  });
  memoryFieldConfig = saved;
  return saved;
}

export function getFacultySettingsMemoryFallback(): FacultySettings {
  return composeFacultySettings(
    memoryFieldConfig,
    api.getSettingsMemoryFallback(),
    memoryFieldConfig?.formTabs,
  );
}
