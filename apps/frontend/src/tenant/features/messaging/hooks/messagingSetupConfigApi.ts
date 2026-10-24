import { apiContract } from "@/lib/api";
import { createModuleSetupConfigApi } from "@/lib/query/createModuleSetupConfigApi";
import { normalizeMessagingPreferences, type MessagingPreferences } from "@mms/shared";

const api = createModuleSetupConfigApi<MessagingPreferences>({
  fetchPreferencesFn: async (_signal) => {
    const res = await apiContract.messaging.getPreferences({ extraHeaders: {} });
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
