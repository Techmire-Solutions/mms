import type { ContactPreferences } from "@mms/contracts";
import { CONTACTS_MODULE_MANIFEST, DEFAULT_CONTACT_PREFERENCES } from "@mms/contracts";
import {
  fetchPreferences,
  savePreferencesAsync,
  setPreferencesMemory,
} from "@mms/mod-contacts/frontend/tenant/lib/preferencesStorage";
import { createModuleSetupConfigHooks } from "@mms/fe-core/query/createModuleSetupConfigHooks";

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
