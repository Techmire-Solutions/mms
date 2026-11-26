import {
  composeUsersSettings,
  normalizeUsersSettings,
  stripUserFieldConfigForPersist,
  type FieldDefinition,
  type UsersSettings,
  type TabDefinition,
} from "@mms/contracts";
import { createModuleFieldConfigService } from "@mms/be-core/data/module-field-config";
import {
  getUserFieldConfigByWorkspace,
  upsertUserFieldConfig,
} from "../repository/db/userFieldConfigRepository.js";
import { getUserModulePreferencesByWorkspace } from "../repository/db/userModulePreferencesRepository.js";

const userFieldConfig = createModuleFieldConfigService<
  Record<string, unknown>,
  UsersSettings,
  TabDefinition,
  Record<string, FieldDefinition[]> | undefined,
  ReturnType<typeof stripUserFieldConfigForPersist>
>({
  broadcastKey: "users",
  getByWorkspace: getUserFieldConfigByWorkspace,
  upsert: upsertUserFieldConfig,
  toDocument: async (raw: Record<string, unknown> | null, tenant: string) => {
    const prefs = await getUserModulePreferencesByWorkspace(tenant);
    return composeUsersSettings(raw, prefs);
  },
  stripForPersist: stripUserFieldConfigForPersist,
  reloadFailedMessage: "Failed to reload user field config after save",
});

export const loadUserFieldConfig = userFieldConfig.load;

export async function saveUserFieldConfig(
  config: UsersSettings | Record<string, unknown>,
): Promise<UsersSettings> {
  return userFieldConfig.save(normalizeUsersSettings(config));
}
