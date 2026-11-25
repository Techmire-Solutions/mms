import { apiContract } from "@mms/fe-core/api/tsRest";
import { assertContractOk } from "@mms/fe-core/api/contractError";
import { createModuleSetupConfigApi } from "@mms/fe-core/query/createModuleSetupConfigApi";
import type { SessionModulePreferences } from "@mms/contracts";
import { normalizeSessionModulePreferences } from "@mms/contracts";

const api = createModuleSetupConfigApi<SessionModulePreferences>({
  fetchPreferencesFn: async (signal) => {
    const res = await apiContract.sessions.getPreferences({
      query: undefined,
      extraHeaders: {},
      signal,
      fetchOptions: { signal },
    });
    assertContractOk(res, "Failed to load session preferences");
    return (res.body as { preferences: SessionModulePreferences }).preferences;
  },
  savePreferencesFn: async (prefs) => {
    const res = await apiContract.sessions.updatePreferences({ body: prefs });
    assertContractOk(res, "Failed to save session preferences");
    return (res.body as { preferences: SessionModulePreferences }).preferences;
  },
  normalizePrefs: normalizeSessionModulePreferences as (prefs: unknown) => SessionModulePreferences,
});

export const setSessionPreferencesMemory = api.setPreferencesMemory;
export const fetchSessionPreferences = api.fetchPreferences;
export const saveSessionPreferencesAsync = api.savePreferencesAsync;
