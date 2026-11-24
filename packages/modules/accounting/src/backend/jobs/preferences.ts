import {
  normalizeAccountingModulePreferences,
  type AccountingModulePreferences,
} from "@mms/contracts";
import { requireTenant } from "@mms/be-core/http";
import { broadcastCollection } from "@mms/be-core/realtime";
import {
  getAccountingModulePreferences,
  setAccountingModulePreferences,
} from "../repository/accountingModulePreferencesRepository.js";

export async function getAccountingPreferencesService(): Promise<AccountingModulePreferences | null> {
  const tenant = requireTenant();
  return normalizeAccountingModulePreferences(await getAccountingModulePreferences(tenant));
}

export async function updateAccountingPreferencesService(
  input: AccountingModulePreferences,
): Promise<AccountingModulePreferences> {
  const tenant = requireTenant();
  const normalized = normalizeAccountingModulePreferences(
    input as unknown as Record<string, unknown>,
  );
  await setAccountingModulePreferences(tenant, normalized as unknown as Record<string, unknown>);
  await broadcastCollection("accounting");
  return input;
}
