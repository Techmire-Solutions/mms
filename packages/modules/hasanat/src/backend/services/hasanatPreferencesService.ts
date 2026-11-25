import { normalizeHasanatModulePreferences, type HasanatModulePreferences } from "@mms/contracts";
import {
  getHasanatModulePreferences,
  setHasanatModulePreferences,
} from "../repository/db/hasanatModulePreferencesRepository.js";
import { createModulePreferencesService } from "@mms/be-core/data/module-preferences";

const service = createModulePreferencesService<HasanatModulePreferences>({
  broadcastKey: "hasanat",
  getByWorkspace: getHasanatModulePreferences,
  upsert: setHasanatModulePreferences,
  normalize: normalizeHasanatModulePreferences,
});

export const getHasanatPreferencesService = service.load;
export const updateHasanatPreferencesService = service.save;
