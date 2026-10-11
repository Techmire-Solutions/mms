import {
  normalizeExaminationsModulePreferences,
  type ExaminationsModulePreferences,
} from "@mms/shared";
import {
  getExaminationModulePreferences,
  setExaminationModulePreferences,
} from "../db/repositories/examinationModulePreferencesRepository.js";
import { createModulePreferencesService } from "../lib/createModulePreferencesService.js";

const service = createModulePreferencesService<ExaminationsModulePreferences>({
  broadcastKey: "examinations",
  getByWorkspace: getExaminationModulePreferences,
  upsert: setExaminationModulePreferences,
  normalize: normalizeExaminationsModulePreferences,
});

export const getExaminationPreferencesService = service.load;
export const updateExaminationPreferencesService = service.save;
