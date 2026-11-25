import {
  composeFinanceSettings,
  normalizeFinanceSettings,
  stripFinanceFieldConfigForPersist,
  type FieldDefinition,
  type FinanceSettings,
  type TabDefinition,
} from "@mms/contracts";
import {
  createModuleFieldConfigService,
  requireFieldConfigTenant,
} from "@mms/be-core/data/module-field-config";
import {
  getFinanceFieldConfigByWorkspace,
  upsertFinanceFieldConfig,
} from "../repository/db/financeFieldConfigRepository.js";
import { getFinanceModulePreferencesByWorkspace } from "../repository/db/financeModulePreferencesRepository.js";

const financeFieldConfig = createModuleFieldConfigService<
  Record<string, unknown>,
  FinanceSettings,
  TabDefinition,
  Record<string, FieldDefinition[]> | undefined,
  ReturnType<typeof stripFinanceFieldConfigForPersist>
>({
  broadcastKey: "finance",
  getByWorkspace: getFinanceFieldConfigByWorkspace,
  upsert: upsertFinanceFieldConfig,
  toDocument: async (raw, tenant) => {
    const prefs = await getFinanceModulePreferencesByWorkspace(tenant);
    return composeFinanceSettings(raw, prefs);
  },
  stripForPersist: stripFinanceFieldConfigForPersist,
  reloadFailedMessage: "Failed to reload finance field config after save",
});

export const loadFinanceFieldConfig = financeFieldConfig.load;

export async function saveFinanceFieldConfig(
  config: FinanceSettings | Record<string, unknown>,
): Promise<FinanceSettings> {
  return financeFieldConfig.save(normalizeFinanceSettings(config));
}

/** Full FinanceSettings for export / validation (field-config + preferences + tabs). */
export async function loadFinanceSettingsCombined(): Promise<FinanceSettings> {
  const tenant = requireFieldConfigTenant();
  const field = await getFinanceFieldConfigByWorkspace(tenant);
  const prefs = await getFinanceModulePreferencesByWorkspace(tenant);
  return composeFinanceSettings(field, prefs);
}
