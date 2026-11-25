import { useMemo } from "react";
import {
  HASANAT_MODULE_MANIFEST,
  normalizeHasanatModulePreferences,
  normalizeHasanatSettings,
  type HasanatModulePreferences,
  type HasanatSettings,
} from "@mms/contracts";
import { createModuleSetupConfigHooks } from "@mms/fe-core/query/createModuleSetupConfigHooks";
import {
  fetchHasanatPreferences,
  saveHasanatPreferencesAsync,
  setHasanatPreferencesMemory,
} from "./hasanatSetupConfigApi.js";

export const HASANAT_PREFERENCES_QUERY_KEY = [
  HASANAT_MODULE_MANIFEST.collectionKey,
  "preferences",
] as const;

const setupConfigHooks = createModuleSetupConfigHooks<HasanatModulePreferences>({
  preferencesQueryKey: HASANAT_PREFERENCES_QUERY_KEY,
  fetchPreferences: fetchHasanatPreferences,
  savePreferences: saveHasanatPreferencesAsync,
  setPreferencesMemory: setHasanatPreferencesMemory,
  preferencesPlaceholder: () => normalizeHasanatModulePreferences(null),
});

export const useHasanatPreferencesQuery = setupConfigHooks.usePreferencesQuery;
export const useHasanatPreferencesMutation = setupConfigHooks.usePreferencesMutation;

/** Composed HasanatSettings from preferences queries. */
export function useComposedHasanatSettings(): HasanatSettings {
  const prefsQuery = useHasanatPreferencesQuery();
  return useMemo(() => normalizeHasanatSettings(prefsQuery.data), [prefsQuery.data]);
}
