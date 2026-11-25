import {
  composeFacultySettings,
  normalizeFacultySettings,
  stripFacultyFieldConfigForPersist,
  type FieldDefinition,
  type FacultySettings,
  type TabDefinition,
} from "@mms/contracts";
import {
  createModuleFieldConfigService,
  requireFieldConfigTenant,
} from "@mms/be-core/data/module-field-config";
import {
  getFacultyFieldConfigByWorkspace,
  upsertFacultyFieldConfig,
} from "../repository/db/facultyFieldConfigRepository.js";
import { getFacultyModulePreferencesByWorkspace } from "../repository/db/facultyModulePreferencesRepository.js";

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
