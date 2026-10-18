import {
  SESSIONS_MODULE_MANIFEST,
  normalizeSessionModulePreferences,
  normalizeSessionsSettings,
  type SessionModulePreferences,
  type SessionsSettings,
} from "@mms/shared";
import { createModuleSetupConfigHooks } from "@/lib/query/createModuleSetupConfigHooks";
import {
  fetchSessionPreferences,
  saveSessionPreferencesAsync,
  setSessionPreferencesMemory,
} from "@/tenant/features/sessions/hooks/sessionSetupConfigApi";

export const SESSIONS_PREFERENCES_QUERY_KEY = [
  SESSIONS_MODULE_MANIFEST.collectionKey,
  "preferences",
] as const;

const setupConfigHooks = createModuleSetupConfigHooks<SessionModulePreferences>({
  preferencesQueryKey: SESSIONS_PREFERENCES_QUERY_KEY,
  fetchPreferences: fetchSessionPreferences,
  savePreferences: saveSessionPreferencesAsync,
  setPreferencesMemory: setSessionPreferencesMemory,
  preferencesPlaceholder: () => normalizeSessionModulePreferences(null),
});

export const useSessionPreferencesQuery = setupConfigHooks.usePreferencesQuery;
export const useSessionPreferencesMutation = setupConfigHooks.usePreferencesMutation;

import { useMemo } from "react";

/** Composed SessionsSettings from preferences queries. */
export function useComposedSessionsSettings(): SessionsSettings {
  const prefsQuery = useSessionPreferencesQuery();
  return useMemo(() => normalizeSessionsSettings(prefsQuery.data), [prefsQuery.data]);
}
