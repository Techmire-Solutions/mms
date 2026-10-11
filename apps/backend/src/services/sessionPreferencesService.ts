import { normalizeSessionModulePreferences, type SessionModulePreferences } from "@mms/shared";
import {
  getSessionModulePreferencesByWorkspace,
  upsertSessionModulePreferences,
} from "../db/repositories/sessionModulePreferencesRepository.js";
import { createModulePreferencesService } from "../lib/createModulePreferencesService.js";

const service = createModulePreferencesService<SessionModulePreferences>({
  broadcastKey: "sessions",
  getByWorkspace: getSessionModulePreferencesByWorkspace,
  upsert: upsertSessionModulePreferences,
  normalize: normalizeSessionModulePreferences,
});

export const loadSessionModulePreferences = service.load;
export const saveSessionModulePreferences = service.save;
