import { apiContract } from "@/lib/api";
import { assertContractOk } from "@/lib/apiContractError";
import { createModuleSetupConfigApi } from "@/lib/query/createModuleSetupConfigApi";
import type { SessionModulePreferences } from "@mms/shared";
import { normalizeSessionModulePreferences } from "@mms/shared";

const api = createModuleSetupConfigApi<SessionModulePreferences>({
  fetchPreferencesFn: async (_signal) => {
    const res = await apiContract.sessions.getPreferences({ query: undefined, extraHeaders: {} });
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
