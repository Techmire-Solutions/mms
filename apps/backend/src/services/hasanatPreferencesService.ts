import { normalizeHasanatModulePreferences, type HasanatModulePreferences } from "@mms/shared";
import {
  getHasanatModulePreferences,
  setHasanatModulePreferences,
} from "../db/repositories/hasanatModulePreferencesRepository.js";
import { createModulePreferencesService } from "../lib/createModulePreferencesService.js";

const service = createModulePreferencesService<HasanatModulePreferences>({
  broadcastKey: "hasanat",
  getByWorkspace: getHasanatModulePreferences,
  upsert: setHasanatModulePreferences,
  normalize: normalizeHasanatModulePreferences,
});

export const getHasanatPreferencesService = service.load;
export const updateHasanatPreferencesService = service.save;
