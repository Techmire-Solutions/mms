import { normalizeStudentModulePreferences, type StudentModulePreferences } from "@mms/contracts";
import {
  getStudentModulePreferencesByWorkspace,
  upsertStudentModulePreferences,
} from "../repository/db/studentModulePreferencesRepository.js";
import { createModulePreferencesService } from "@mms/be-core/data/module-preferences";

const service = createModulePreferencesService<StudentModulePreferences>({
  broadcastKey: "students",
  getByWorkspace: getStudentModulePreferencesByWorkspace,
  upsert: upsertStudentModulePreferences,
  normalize: normalizeStudentModulePreferences,
});

export const loadStudentModulePreferences = service.load;
export const saveStudentModulePreferences = service.save;
