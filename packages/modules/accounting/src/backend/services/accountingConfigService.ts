import {
  composeAccountingSettings,
  normalizeAccountingModulePreferences,
  normalizeAccountingSettings,
  stripAccountingFieldConfigForPersist,
  type FieldDefinition,
  type AccountingSettings,
  type TabDefinition,
} from "@mms/contracts";
import { createModuleFieldConfigService } from "./createModuleFieldConfigService.js";
import {
  getAccountingFieldConfig,
  setAccountingFieldConfig,
} from "../repository/accountingFieldConfigRepository.js";
import { getAccountingModulePreferences } from "../repository/accountingModulePreferencesRepository.js";

const accountingFieldConfig = createModuleFieldConfigService<
  Record<string, unknown>,
  AccountingSettings,
  TabDefinition,
  Record<string, FieldDefinition[]> | undefined,
  ReturnType<typeof stripAccountingFieldConfigForPersist>
>({
  broadcastKey: "accounting",
  getByWorkspace: getAccountingFieldConfig,
  upsert: setAccountingFieldConfig,
  toDocument: async (raw, tenant) => {
    const prefs = await getAccountingModulePreferences(tenant);
    return composeAccountingSettings(
      normalizeAccountingSettings(raw),
      normalizeAccountingModulePreferences(prefs),
    );
  },
  stripForPersist: stripAccountingFieldConfigForPersist,
  reloadFailedMessage: "Failed to reload accounting field config after save",
});

export const getAccountingFieldConfigService = accountingFieldConfig.load;

export async function updateAccountingFieldConfigService(
  config: AccountingSettings | Record<string, unknown>,
): Promise<AccountingSettings> {
  return accountingFieldConfig.save(normalizeAccountingSettings(config));
}
