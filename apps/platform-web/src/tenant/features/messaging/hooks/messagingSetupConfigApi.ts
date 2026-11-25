import { apiContract } from "@mms/fe-core/api/tsRest";
import { createModuleSetupConfigApi } from "@mms/fe-core/query/createModuleSetupConfigApi";
import { normalizeMessagingPreferences, type MessagingPreferences } from "@mms/contracts";

const api = createModuleSetupConfigApi<MessagingPreferences>({
  fetchPreferencesFn: async (signal) => {
    const res = await apiContract.messaging.getPreferences({
      extraHeaders: {},
      signal,
      fetchOptions: { signal },
    });
    return (res.body as { preferences: MessagingPreferences }).preferences;
  },
  savePreferencesFn: async (prefs) => {
    const res = await apiContract.messaging.updatePreferences({ body: prefs });
    return (res.body as { preferences: MessagingPreferences }).preferences;
  },
  normalizePrefs: normalizeMessagingPreferences as (prefs: unknown) => MessagingPreferences,
});

export const setMessagingPreferencesMemory = api.setPreferencesMemory;
export const fetchMessagingPreferences = api.fetchPreferences;
export const saveMessagingPreferencesAsync = api.savePreferencesAsync;
