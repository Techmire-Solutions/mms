import type { ContactPreferences } from "@mms/shared";
import { CONTACTS_MODULE_MANIFEST, DEFAULT_CONTACT_PREFERENCES } from "@mms/shared";
import {
  fetchPreferences,
  savePreferencesAsync,
  setPreferencesMemory,
} from "@/lib/contacts/preferencesStorage";
import { createModuleSetupConfigHooks } from "@/lib/query/createModuleSetupConfigHooks";

export const CONTACTS_PREFERENCES_QUERY_KEY = [
  CONTACTS_MODULE_MANIFEST.collectionKey,
  "preferences",
] as const;

const setupConfigHooks = createModuleSetupConfigHooks<ContactPreferences>({
  preferencesQueryKey: CONTACTS_PREFERENCES_QUERY_KEY,
  fetchPreferences,
  savePreferences: savePreferencesAsync,
  setPreferencesMemory,
  preferencesPlaceholder: DEFAULT_CONTACT_PREFERENCES,
});

export const useContactPreferencesQuery = setupConfigHooks.usePreferencesQuery;
export const useContactPreferencesMutation = setupConfigHooks.usePreferencesMutation;
