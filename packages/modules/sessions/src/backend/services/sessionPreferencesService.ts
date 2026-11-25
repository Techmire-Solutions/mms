import { normalizeSessionModulePreferences, type SessionModulePreferences } from "@mms/contracts";
import {
  getSessionModulePreferencesByWorkspace,
  upsertSessionModulePreferences,
} from "../repository/db/sessionModulePreferencesRepository.js";
import { createModulePreferencesService } from "@mms/be-core/data/module-preferences";

const service = createModulePreferencesService<SessionModulePreferences>({
  broadcastKey: "sessions",
  getByWorkspace: getSessionModulePreferencesByWorkspace,
  upsert: upsertSessionModulePreferences,
  normalize: normalizeSessionModulePreferences,
});

export const loadSessionModulePreferences = service.load;
export const saveSessionModulePreferences = service.save;
