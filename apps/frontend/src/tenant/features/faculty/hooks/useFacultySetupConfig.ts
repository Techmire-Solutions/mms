import { useContext, useMemo } from "react";
import {
  FACULTY_MODULE_MANIFEST,
  composeFacultySettings,
  normalizeFacultyModulePreferences,
  normalizeFacultySettings,
  type FacultyModulePreferences,
  type FacultySettings,
} from "@mms/shared";
import { QueryClient, QueryClientContext, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { SETUP_STALE_TIME } from "@/lib/queryClient";
import { createModuleSetupConfigHooks } from "@/lib/query/createModuleSetupConfigHooks";
import {
  fetchFacultyFieldConfig,
  fetchFacultyPreferences,
  saveFacultyPreferencesAsync,
  setFacultyPreferencesMemory,
} from "@/tenant/features/faculty/hooks/facultySetupConfigApi";

export const FACULTY_PREFERENCES_QUERY_KEY = [
  FACULTY_MODULE_MANIFEST.collectionKey,
  "preferences",
] as const;

export const FACULTY_FIELD_CONFIG_QUERY_KEY = [
  FACULTY_MODULE_MANIFEST.collectionKey,
  "field-config",
] as const;

const DEFAULT_FACULTY_MODULE_PREFERENCES: FacultyModulePreferences =
  normalizeFacultyModulePreferences(null);
const DEFAULT_FACULTY_FIELD_CONFIG: FacultySettings = normalizeFacultySettings(null);

const fallbackQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const setupConfigHooks = createModuleSetupConfigHooks<FacultyModulePreferences>({
  preferencesQueryKey: FACULTY_PREFERENCES_QUERY_KEY,
  fetchPreferences: fetchFacultyPreferences,
  savePreferences: saveFacultyPreferencesAsync,
  setPreferencesMemory: setFacultyPreferencesMemory,
  preferencesPlaceholder: () => DEFAULT_FACULTY_MODULE_PREFERENCES,
});

export const useFacultyPreferencesQuery = setupConfigHooks.usePreferencesQuery;
export const useFacultyPreferencesMutation = setupConfigHooks.usePreferencesMutation;

function useSafeAuth() {
  try {
    return useAuth();
  } catch {
    return null;
  }
}

/** Tenant field-config from GET /api/faculty/field-config. */
export function useFacultyFieldConfigQuery() {
  const auth = useSafeAuth();
  const client = useContext(QueryClientContext) ?? fallbackQueryClient;
  return useQuery(
    {
      queryKey: FACULTY_FIELD_CONFIG_QUERY_KEY,
      queryFn: ({ signal }) => fetchFacultyFieldConfig(signal),
      enabled: Boolean(auth?.isAuthenticated),
      placeholderData: DEFAULT_FACULTY_FIELD_CONFIG,
      staleTime: SETUP_STALE_TIME,
      gcTime: 10 * 60_000,
    },
    client,
  );
}

/** Composed FacultySettings from field-config + preferences queries. */
export function useComposedFacultySettings(): FacultySettings {
  const fieldConfigQuery = useFacultyFieldConfigQuery();
  const prefsQuery = useFacultyPreferencesQuery();
  return useMemo(
    () =>
      composeFacultySettings(
        fieldConfigQuery.data ?? null,
        prefsQuery.data ?? DEFAULT_FACULTY_MODULE_PREFERENCES,
      ),
    [fieldConfigQuery.data, prefsQuery.data],
  );
}
