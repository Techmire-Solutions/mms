import {
  EXAMINATIONS_MODULE_MANIFEST,
  normalizeExaminationsModulePreferences,
  normalizeExaminationsSettings,
  type ExaminationsModulePreferences,
  type ExaminationsSettings,
} from "@mms/shared";
import { createModuleSetupConfigHooks } from "@/lib/query/createModuleSetupConfigHooks";
import {
  fetchExaminationPreferences,
  saveExaminationPreferencesAsync,
  setExaminationPreferencesMemory,
} from "@/tenant/features/examinations/hooks/examinationSetupConfigApi";

export const EXAMINATIONS_PREFERENCES_QUERY_KEY = [
  EXAMINATIONS_MODULE_MANIFEST.collectionKey,
  "preferences",
] as const;

const setupConfigHooks = createModuleSetupConfigHooks<ExaminationsModulePreferences>({
  preferencesQueryKey: EXAMINATIONS_PREFERENCES_QUERY_KEY,
  fetchPreferences: fetchExaminationPreferences,
  savePreferences: saveExaminationPreferencesAsync,
  setPreferencesMemory: setExaminationPreferencesMemory,
  preferencesPlaceholder: () => normalizeExaminationsModulePreferences(null),
});

export const useExaminationPreferencesQuery = setupConfigHooks.usePreferencesQuery;
export const useExaminationPreferencesMutation = setupConfigHooks.usePreferencesMutation;

import { useMemo } from "react";

/** Composed ExaminationsSettings from preferences queries. */
export function useComposedExaminationsSettings(): ExaminationsSettings {
  const prefsQuery = useExaminationPreferencesQuery();
  return useMemo(() => normalizeExaminationsSettings(prefsQuery.data), [prefsQuery.data]);
}
