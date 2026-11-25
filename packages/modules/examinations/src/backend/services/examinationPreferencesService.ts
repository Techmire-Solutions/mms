import {
  normalizeExaminationsModulePreferences,
  type ExaminationsModulePreferences,
} from "@mms/contracts";
import {
  getExaminationModulePreferences,
  setExaminationModulePreferences,
} from "../repository/examinationModulePreferencesRepository.js";
import { createModulePreferencesService } from "@mms/be-core/data/module-preferences";

const service = createModulePreferencesService<ExaminationsModulePreferences>({
  broadcastKey: "examinations",
  getByWorkspace: getExaminationModulePreferences,
  upsert: setExaminationModulePreferences,
  normalize: normalizeExaminationsModulePreferences,
});

export const getExaminationPreferencesService = service.load;
export const updateExaminationPreferencesService = service.save;
