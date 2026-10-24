import {
  STUDENTS_MODULE_MANIFEST,
  normalizeStudentModulePreferences,
  normalizeStudentsSettings,
  type StudentModulePreferences,
  type StudentsSettings,
} from "@mms/shared";
import { createModuleSetupConfigHooks } from "@/lib/query/createModuleSetupConfigHooks";
import {
  fetchStudentPreferences,
  saveStudentPreferencesAsync,
  setStudentPreferencesMemory,
} from "@/tenant/features/students/hooks/studentSetupConfigApi";

export const STUDENTS_PREFERENCES_QUERY_KEY = [
  STUDENTS_MODULE_MANIFEST.collectionKey,
  "preferences",
] as const;

const setupConfigHooks = createModuleSetupConfigHooks<StudentModulePreferences>({
  preferencesQueryKey: STUDENTS_PREFERENCES_QUERY_KEY,
  fetchPreferences: fetchStudentPreferences,
  savePreferences: saveStudentPreferencesAsync,
  setPreferencesMemory: setStudentPreferencesMemory,
  preferencesPlaceholder: () => normalizeStudentModulePreferences(null),
});

export const useStudentPreferencesQuery = setupConfigHooks.usePreferencesQuery;
export const useStudentPreferencesMutation = setupConfigHooks.usePreferencesMutation;

import { useMemo } from "react";

/** Composed StudentsSettings from preferences queries. */
export function useComposedStudentsSettings(): StudentsSettings {
  const prefsQuery = useStudentPreferencesQuery();
  return useMemo(() => normalizeStudentsSettings(prefsQuery.data), [prefsQuery.data]);
}
