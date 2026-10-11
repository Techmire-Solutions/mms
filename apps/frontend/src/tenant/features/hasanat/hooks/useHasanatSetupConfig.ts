import {
  HASANAT_MODULE_MANIFEST,
  normalizeHasanatModulePreferences,
  normalizeHasanatSettings,
  type HasanatModulePreferences,
  type HasanatSettings,
} from "@mms/shared";
import { createModuleSetupConfigHooks } from "@/lib/query/createModuleSetupConfigHooks";
import {
  fetchHasanatPreferences,
  saveHasanatPreferencesAsync,
  setHasanatPreferencesMemory,
} from "@/tenant/features/hasanat/hooks/hasanatSetupConfigApi";

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

import { useMemo } from "react";

/** Composed HasanatSettings from preferences queries. */
export function useComposedHasanatSettings(): HasanatSettings {
  const prefsQuery = useHasanatPreferencesQuery();
  return useMemo(() => normalizeHasanatSettings(prefsQuery.data), [prefsQuery.data]);
}
