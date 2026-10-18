import {
  composeFacultySettings,
  normalizeFacultySettings,
  stripFacultyFieldConfigForPersist,
  type FieldDefinition,
  type FacultySettings,
  type TabDefinition,
} from "@mms/shared";
import {
  createModuleFieldConfigService,
  requireFieldConfigTenant,
} from "../../lib/createModuleFieldConfigService.js";
import {
  getFacultyFieldConfigByWorkspace,
  upsertFacultyFieldConfig,
} from "../../db/repositories/facultyFieldConfigRepository.js";
import { getFacultyModulePreferencesByWorkspace } from "../../db/repositories/facultyModulePreferencesRepository.js";

const facultyFieldConfig = createModuleFieldConfigService<
  Record<string, unknown>,
  FacultySettings,
  TabDefinition,
  Record<string, FieldDefinition[]> | undefined,
  ReturnType<typeof stripFacultyFieldConfigForPersist>
>({
  broadcastKey: "faculty",
  getByWorkspace: getFacultyFieldConfigByWorkspace,
  upsert: upsertFacultyFieldConfig,
  toDocument: async (raw, tenant) => {
    const prefs = await getFacultyModulePreferencesByWorkspace(tenant);
    return composeFacultySettings(raw, prefs);
  },
  stripForPersist: stripFacultyFieldConfigForPersist,
  reloadFailedMessage: "Failed to reload faculty field config after save",
});

export const loadFacultyFieldConfig = facultyFieldConfig.load;

export async function saveFacultyFieldConfig(
  config: FacultySettings | Record<string, unknown>,
): Promise<FacultySettings> {
  return facultyFieldConfig.save(normalizeFacultySettings(config));
}

/** Full FacultySettings for validation / employee ID (field-config + preferences + tabs). */
export async function loadFacultySettingsCombined(): Promise<FacultySettings> {
  const tenant = requireFieldConfigTenant();
  const field = await getFacultyFieldConfigByWorkspace(tenant);
  const prefs = await getFacultyModulePreferencesByWorkspace(tenant);
  return composeFacultySettings(field, prefs);
}
