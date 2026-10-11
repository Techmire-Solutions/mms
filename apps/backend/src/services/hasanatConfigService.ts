import {
  composeHasanatSettings,
  normalizeHasanatSettings,
  normalizeHasanatModulePreferences,
  stripHasanatFieldConfigForPersist,
  type HasanatSettings,
  type TabDefinition,
} from "@mms/shared";
import { createModuleFieldConfigService } from "../lib/createModuleFieldConfigService.js";
import {
  getHasanatFieldConfig,
  setHasanatFieldConfig,
} from "../db/repositories/hasanatFieldConfigRepository.js";
import { getHasanatModulePreferences } from "../db/repositories/hasanatModulePreferencesRepository.js";

const hasanatFieldConfig = createModuleFieldConfigService<
  Record<string, unknown>,
  HasanatSettings,
  TabDefinition,
  unknown,
  Partial<HasanatSettings>
>({
  broadcastKey: "hasanat",
  getByWorkspace: getHasanatFieldConfig,
  upsert: setHasanatFieldConfig,
  toDocument: async (raw, tenant) => {
    const prefs = await getHasanatModulePreferences(tenant);
    const normalizedPrefs = normalizeHasanatModulePreferences(prefs);
    const normalizedConfig = normalizeHasanatSettings(raw);
    return composeHasanatSettings(normalizedConfig, normalizedPrefs);
  },
  stripForPersist: stripHasanatFieldConfigForPersist,
  reloadFailedMessage: "Failed to reload hasanat field config after save",
});

export const getHasanatFieldConfigService = hasanatFieldConfig.load;

export async function updateHasanatFieldConfigService(
  config: HasanatSettings | Record<string, unknown>,
): Promise<HasanatSettings> {
  return hasanatFieldConfig.save(normalizeHasanatSettings(config));
}
