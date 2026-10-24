import {
  USERS_MODULE_MANIFEST,
  normalizeUserModulePreferences,
  normalizeUsersSettings,
  type UserModulePreferences,
  type UsersSettings,
} from "@mms/shared";
import { createModuleSetupConfigHooks } from "@/lib/query/createModuleSetupConfigHooks";
import {
  fetchUserPreferences,
  saveUserPreferencesAsync,
  setUserPreferencesMemory,
} from "@/tenant/features/users/hooks/userSetupConfigApi";

export const USERS_PREFERENCES_QUERY_KEY = [
  USERS_MODULE_MANIFEST.collectionKey,
  "preferences",
] as const;

const setupConfigHooks = createModuleSetupConfigHooks<UserModulePreferences>({
  preferencesQueryKey: USERS_PREFERENCES_QUERY_KEY,
  fetchPreferences: fetchUserPreferences,
  savePreferences: saveUserPreferencesAsync,
  setPreferencesMemory: setUserPreferencesMemory,
  preferencesPlaceholder: () => normalizeUserModulePreferences(null),
});

export const useUserPreferencesQuery = setupConfigHooks.usePreferencesQuery;
export const useUserPreferencesMutation = setupConfigHooks.usePreferencesMutation;

import { useMemo } from "react";

/** Composed UsersSettings from preferences queries. */
export function useComposedUsersSettings(): UsersSettings {
  const prefsQuery = useUserPreferencesQuery();
  return useMemo(() => normalizeUsersSettings(prefsQuery.data), [prefsQuery.data]);
}
