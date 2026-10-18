import {
  composeExaminationsSettings,
  normalizeExaminationsSettings,
  normalizeExaminationsModulePreferences,
  stripExaminationsFieldConfigForPersist,
  type FieldDefinition,
  type ExaminationsSettings,
  type TabDefinition,
} from "@mms/shared";
import { createModuleFieldConfigService } from "../lib/createModuleFieldConfigService.js";
import {
  getExaminationFieldConfig,
  setExaminationFieldConfig,
} from "../db/repositories/examinationFieldConfigRepository.js";
import { getExaminationModulePreferences } from "../db/repositories/examinationModulePreferencesRepository.js";

const examinationFieldConfig = createModuleFieldConfigService<
  Record<string, unknown>,
  ExaminationsSettings,
  TabDefinition,
  Record<string, FieldDefinition[]> | undefined,
  ReturnType<typeof stripExaminationsFieldConfigForPersist>
>({
  broadcastKey: "examinations",
  getByWorkspace: getExaminationFieldConfig,
  upsert: setExaminationFieldConfig,
  toDocument: async (raw, tenant) => {
    const prefs = await getExaminationModulePreferences(tenant);
    return composeExaminationsSettings(
      normalizeExaminationsSettings(raw),
      normalizeExaminationsModulePreferences(prefs),
    );
  },
  stripForPersist: stripExaminationsFieldConfigForPersist,
  reloadFailedMessage: "Failed to reload examinations field config after save",
});

export const getExaminationFieldConfigService = examinationFieldConfig.load;

export async function updateExaminationFieldConfigService(
  config: ExaminationsSettings | Record<string, unknown>,
): Promise<ExaminationsSettings> {
  return examinationFieldConfig.save(normalizeExaminationsSettings(config));
}
