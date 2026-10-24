import {
  composeEnrollmentsSettings,
  normalizeEnrollmentsSettings,
  stripEnrollmentFieldConfigForPersist,
  type FieldDefinition,
  type EnrollmentsSettings,
  type TabDefinition,
} from "@mms/shared";
import {
  createModuleFieldConfigService,
  requireFieldConfigTenant,
} from "../lib/createModuleFieldConfigService.js";
import {
  getEnrollmentFieldConfigByWorkspace,
  upsertEnrollmentFieldConfig,
} from "../db/repositories/enrollmentFieldConfigRepository.js";
import { getEnrollmentModulePreferencesByWorkspace } from "../db/repositories/enrollmentModulePreferencesRepository.js";

const enrollmentFieldConfig = createModuleFieldConfigService<
  Record<string, unknown>,
  EnrollmentsSettings,
  TabDefinition,
  Record<string, FieldDefinition[]> | undefined,
  ReturnType<typeof stripEnrollmentFieldConfigForPersist>
>({
  broadcastKey: "enrollments",
  getByWorkspace: getEnrollmentFieldConfigByWorkspace,
  upsert: upsertEnrollmentFieldConfig,
  toDocument: async (raw, tenant) => {
    const prefs = await getEnrollmentModulePreferencesByWorkspace(tenant);
    return composeEnrollmentsSettings(raw, prefs);
  },
  stripForPersist: stripEnrollmentFieldConfigForPersist,
  reloadFailedMessage: "Failed to reload enrollment field config after save",
});

export const loadEnrollmentFieldConfig = enrollmentFieldConfig.load;

export async function saveEnrollmentFieldConfig(
  config: EnrollmentsSettings | Record<string, unknown>,
): Promise<EnrollmentsSettings> {
  return enrollmentFieldConfig.save(normalizeEnrollmentsSettings(config));
}

/** Full EnrollmentsSettings for export / validation (field-config + preferences + tabs). */
export async function loadEnrollmentsSettingsCombined(): Promise<EnrollmentsSettings> {
  const tenant = requireFieldConfigTenant();
  const field = await getEnrollmentFieldConfigByWorkspace(tenant);
  const prefs = await getEnrollmentModulePreferencesByWorkspace(tenant);
  return composeEnrollmentsSettings(field, prefs);
}
