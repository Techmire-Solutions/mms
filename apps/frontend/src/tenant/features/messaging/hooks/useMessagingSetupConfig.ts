import {
  MESSAGING_MODULE_MANIFEST,
  normalizeMessagingPreferences,
  type MessagingPreferences,
} from "@mms/shared";
import { createModuleSetupConfigHooks } from "@/lib/query/createModuleSetupConfigHooks";
import {
  fetchMessagingPreferences,
  saveMessagingPreferencesAsync,
  setMessagingPreferencesMemory,
} from "./messagingSetupConfigApi";

export const MESSAGING_PREFERENCES_QUERY_KEY = [
  MESSAGING_MODULE_MANIFEST.collectionKey,
  "preferences",
] as const;

const setupConfigHooks = createModuleSetupConfigHooks<MessagingPreferences>({
  preferencesQueryKey: MESSAGING_PREFERENCES_QUERY_KEY,
  fetchPreferences: fetchMessagingPreferences,
  savePreferences: saveMessagingPreferencesAsync,
  setPreferencesMemory: setMessagingPreferencesMemory,
  preferencesPlaceholder: () => normalizeMessagingPreferences(null),
});

export const useMessagingPreferencesQuery = setupConfigHooks.usePreferencesQuery;
export const useMessagingPreferencesMutation = setupConfigHooks.usePreferencesMutation;
