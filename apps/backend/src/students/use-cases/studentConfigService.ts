import {
  composeStudentsSettings,
  normalizeStudentsSettings,
  stripStudentFieldConfigForPersist,
  type FieldDefinition,
  type StudentsSettings,
  type TabDefinition,
} from "@mms/shared";
import {
  createModuleFieldConfigService,
  requireFieldConfigTenant,
} from "../../lib/createModuleFieldConfigService.js";
import {
  getStudentFieldConfigByWorkspace,
  upsertStudentFieldConfig,
} from "../../db/repositories/studentFieldConfigRepository.js";
import { getStudentModulePreferencesByWorkspace } from "../../db/repositories/studentModulePreferencesRepository.js";

const studentFieldConfig = createModuleFieldConfigService<
  Record<string, unknown>,
  StudentsSettings,
  TabDefinition,
  Record<string, FieldDefinition[]> | undefined,
  ReturnType<typeof stripStudentFieldConfigForPersist>
>({
  broadcastKey: "students",
  getByWorkspace: getStudentFieldConfigByWorkspace,
  upsert: upsertStudentFieldConfig,
  toDocument: async (raw, tenant) => {
    const prefs = await getStudentModulePreferencesByWorkspace(tenant);
    return composeStudentsSettings(raw, prefs);
  },
  stripForPersist: stripStudentFieldConfigForPersist,
  reloadFailedMessage: "Failed to reload student field config after save",
});

/** Load typed field-config row. */
export const loadStudentFieldConfig = studentFieldConfig.load;

export async function saveStudentFieldConfig(
  config: StudentsSettings | Record<string, unknown>,
): Promise<StudentsSettings> {
  return studentFieldConfig.save(normalizeStudentsSettings(config));
}

/** Full StudentsSettings for validation / GR (field-config + preferences + tabs). */
export async function loadStudentsSettingsCombined(): Promise<StudentsSettings> {
  const tenant = requireFieldConfigTenant();
  const field = await getStudentFieldConfigByWorkspace(tenant);
  const prefs = await getStudentModulePreferencesByWorkspace(tenant);
  return composeStudentsSettings(field, prefs);
}
