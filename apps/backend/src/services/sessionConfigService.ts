import {
  composeSessionsSettings,
  normalizeSessionsSettings,
  stripSessionFieldConfigForPersist,
  type FieldDefinition,
  type SessionsSettings,
  type TabDefinition,
} from "@mms/shared";
import {
  createModuleFieldConfigService,
  requireFieldConfigTenant,
} from "../lib/createModuleFieldConfigService.js";
import {
  getSessionFieldConfigByWorkspace,
  upsertSessionFieldConfig,
} from "../db/repositories/sessionFieldConfigRepository.js";
import { getSessionModulePreferencesByWorkspace } from "../db/repositories/sessionModulePreferencesRepository.js";

const sessionFieldConfig = createModuleFieldConfigService<
  Record<string, unknown>,
  SessionsSettings,
  TabDefinition,
  Record<string, FieldDefinition[]> | undefined,
  ReturnType<typeof stripSessionFieldConfigForPersist>
>({
  broadcastKey: "sessions",
  getByWorkspace: getSessionFieldConfigByWorkspace,
  upsert: upsertSessionFieldConfig,
  toDocument: async (raw, tenant) => {
    const prefs = await getSessionModulePreferencesByWorkspace(tenant);
    return composeSessionsSettings(raw, prefs);
  },
  stripForPersist: stripSessionFieldConfigForPersist,
  reloadFailedMessage: "Failed to reload session field config after save",
});

export const loadSessionFieldConfig = sessionFieldConfig.load;

export async function saveSessionFieldConfig(
  config: SessionsSettings | Record<string, unknown>,
): Promise<SessionsSettings> {
  return sessionFieldConfig.save(normalizeSessionsSettings(config));
}

/** Full SessionsSettings for export / validation (field-config + preferences + tabs). */
export async function loadSessionsSettingsCombined(): Promise<SessionsSettings> {
  const tenant = requireFieldConfigTenant();
  const field = await getSessionFieldConfigByWorkspace(tenant);
  const prefs = await getSessionModulePreferencesByWorkspace(tenant);
  return composeSessionsSettings(field, prefs);
}
