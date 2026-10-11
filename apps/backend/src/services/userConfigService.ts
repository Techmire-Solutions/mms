import {
  composeUsersSettings,
  normalizeUsersSettings,
  stripUserFieldConfigForPersist,
  type FieldDefinition,
  type UsersSettings,
  type TabDefinition,
} from "@mms/shared";
import { createModuleFieldConfigService } from "../lib/createModuleFieldConfigService.js";
import {
  getUserFieldConfigByWorkspace,
  upsertUserFieldConfig,
} from "../db/repositories/userFieldConfigRepository.js";
import { getUserModulePreferencesByWorkspace } from "../db/repositories/userModulePreferencesRepository.js";

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
  toDocument: async (raw, tenant) => {
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
