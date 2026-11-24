import { useMemo } from "react";
import {
  normalizeAccountingModulePreferences,
  normalizeAccountingSettings,
  type AccountingModulePreferences,
  type AccountingSettings,
} from "@mms/contracts";
import { createModuleSetupConfigHooks } from "@mms/fe-core/query/createModuleSetupConfigHooks";
import {
  fetchAccountingPreferences,
  saveAccountingPreferencesAsync,
  setAccountingPreferencesMemory,
} from "./accountingSetupConfigApi";
import { ACCOUNTING_PREFERENCES_QUERY_KEY } from "./accountingQueryKeys";

const setupConfigHooks = createModuleSetupConfigHooks<AccountingModulePreferences>({
  preferencesQueryKey: ACCOUNTING_PREFERENCES_QUERY_KEY,
  fetchPreferences: fetchAccountingPreferences,
  savePreferences: saveAccountingPreferencesAsync,
  setPreferencesMemory: setAccountingPreferencesMemory,
  preferencesPlaceholder: () => normalizeAccountingModulePreferences(null),
});

export const useAccountingPreferencesQuery = setupConfigHooks.usePreferencesQuery;
export const useAccountingPreferencesMutation = setupConfigHooks.usePreferencesMutation;

/** Composed AccountingSettings from preferences queries. */
export function useComposedAccountingSettings(): AccountingSettings {
  const prefsQuery = useAccountingPreferencesQuery();
  return useMemo(() => normalizeAccountingSettings(prefsQuery.data), [prefsQuery.data]);
}
