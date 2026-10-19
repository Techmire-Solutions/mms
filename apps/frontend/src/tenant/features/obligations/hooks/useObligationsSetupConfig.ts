import { useMemo } from "react";
import {
  OBLIGATIONS_MODULE_MANIFEST,
  normalizeObligationsModulePreferences,
  normalizeObligationsSettings,
  type ObligationsModulePreferences,
  type ObligationsSettings,
} from "@mms/shared";
import { createModuleSetupConfigHooks } from "@/lib/query/createModuleSetupConfigHooks";
import {
  fetchObligationsPreferences,
  saveObligationsPreferencesAsync,
  setObligationsPreferencesMemory,
} from "@/tenant/features/obligations/hooks/obligationsSetupConfigApi";

export const OBLIGATIONS_PREFERENCES_QUERY_KEY = [
  OBLIGATIONS_MODULE_MANIFEST.collectionKey,
  "preferences",
] as const;

const setupConfigHooks = createModuleSetupConfigHooks<
  ObligationsModulePreferences,
  ObligationsSettings
>({
  preferencesQueryKey: OBLIGATIONS_PREFERENCES_QUERY_KEY,
  fetchPreferences: fetchObligationsPreferences,
  savePreferences: (settings: ObligationsSettings) =>
    saveObligationsPreferencesAsync(normalizeObligationsModulePreferences(settings)),
  setPreferencesMemory: (prefs: ObligationsModulePreferences) =>
    setObligationsPreferencesMemory(prefs),
  preferencesPlaceholder: () => normalizeObligationsModulePreferences(null),
});

export const useObligationsPreferencesQuery = setupConfigHooks.usePreferencesQuery;
export const useObligationsPreferencesMutation = setupConfigHooks.usePreferencesMutation;

/** Composed ObligationsSettings from server preferences queries. */
export function useComposedObligationsSettings(): ObligationsSettings {
  const prefsQuery = useObligationsPreferencesQuery();
  return useMemo(() => normalizeObligationsSettings(prefsQuery.data), [prefsQuery.data]);
}
