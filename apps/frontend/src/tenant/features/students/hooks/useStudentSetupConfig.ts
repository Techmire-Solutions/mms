import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  STUDENTS_MODULE_MANIFEST,
  composeStudentsSettings,
  normalizeStudentModulePreferences,
  normalizeStudentsSettings,
  type StudentModulePreferences,
  type StudentsSettings,
} from "@mms/shared";
import { SETUP_STALE_TIME } from "@/lib/queryClient";
import { createModuleSetupConfigHooks } from "@/lib/query/createModuleSetupConfigHooks";
import { useAuthOrNull, useQueryClientOrFallback } from "@/lib/query/optionalQueryContext";
import {
  fetchStudentFieldConfig,
  fetchStudentPreferences,
  saveStudentFieldConfigAsync,
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

export const STUDENTS_FIELD_CONFIG_QUERY_KEY = [
  STUDENTS_MODULE_MANIFEST.collectionKey,
  "field-config",
] as const;

const DEFAULT_STUDENT_FIELD_CONFIG: StudentsSettings = normalizeStudentsSettings(null);

/** Tenant field registry (required/enabled flags) from GET /api/students/field-config. */
export function useStudentFieldConfigQuery() {
  const auth = useAuthOrNull();
  const client = useQueryClientOrFallback();
  return useQuery(
    {
      queryKey: STUDENTS_FIELD_CONFIG_QUERY_KEY,
      queryFn: ({ signal }) => fetchStudentFieldConfig(signal),
      enabled: Boolean(auth?.isAuthenticated),
      placeholderData: DEFAULT_STUDENT_FIELD_CONFIG,
      staleTime: SETUP_STALE_TIME,
      gcTime: 10 * 60_000,
    },
    client,
  );
}

/** Saves the field registry; the form and server blueprint read the saved flags. */
export function useStudentFieldConfigMutation() {
  const client = useQueryClientOrFallback();
  return useMutation(
    {
      mutationFn: (config: StudentsSettings) => saveStudentFieldConfigAsync(config),
      onSuccess: (saved) => {
        client.setQueryData(STUDENTS_FIELD_CONFIG_QUERY_KEY, saved);
        void client.invalidateQueries({ queryKey: STUDENTS_FIELD_CONFIG_QUERY_KEY });
      },
    },
    client,
  );
}

/**
 * Composed StudentsSettings: saved field registry + preferences. The form validates with the
 * same required flags the server enforces, so Setup "Required fields" applies on both sides.
 */
export function useComposedStudentsSettings(): StudentsSettings {
  const fieldConfigQuery = useStudentFieldConfigQuery();
  const prefsQuery = useStudentPreferencesQuery();
  return useMemo(
    () => composeStudentsSettings(fieldConfigQuery.data ?? null, prefsQuery.data ?? null),
    [fieldConfigQuery.data, prefsQuery.data],
  );
}
