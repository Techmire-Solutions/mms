import {
  ACCOUNTING_MODULE_MANIFEST,
  normalizeAccountingModulePreferences,
  normalizeAccountingSettings,
  type AccountingModulePreferences,
  type AccountingSettings,
} from "@mms/shared";
import { createModuleSetupConfigHooks } from "@/lib/query/createModuleSetupConfigHooks";
import {
  fetchAccountingPreferences,
  saveAccountingPreferencesAsync,
  setAccountingPreferencesMemory,
} from "@/tenant/features/accounting/hooks/accountingSetupConfigApi";

export const ACCOUNTING_PREFERENCES_QUERY_KEY = [
  ACCOUNTING_MODULE_MANIFEST.collectionKey,
  "preferences",
] as const;

const setupConfigHooks = createModuleSetupConfigHooks<AccountingModulePreferences>({
  preferencesQueryKey: ACCOUNTING_PREFERENCES_QUERY_KEY,
  fetchPreferences: fetchAccountingPreferences,
  savePreferences: saveAccountingPreferencesAsync,
  setPreferencesMemory: setAccountingPreferencesMemory,
  preferencesPlaceholder: () => normalizeAccountingModulePreferences(null),
});

export const useAccountingPreferencesQuery = setupConfigHooks.usePreferencesQuery;
export const useAccountingPreferencesMutation = setupConfigHooks.usePreferencesMutation;

import { useMemo } from "react";

/** Composed AccountingSettings from preferences queries. */
export function useComposedAccountingSettings(): AccountingSettings {
  const prefsQuery = useAccountingPreferencesQuery();
  return useMemo(() => normalizeAccountingSettings(prefsQuery.data), [prefsQuery.data]);
}
