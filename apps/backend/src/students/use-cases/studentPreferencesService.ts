import { normalizeStudentModulePreferences, type StudentModulePreferences } from "@mms/shared";
import {
  getStudentModulePreferencesByWorkspace,
  upsertStudentModulePreferences,
} from "../../db/repositories/studentModulePreferencesRepository.js";
import { createModulePreferencesService } from "../../lib/createModulePreferencesService.js";

const service = createModulePreferencesService<StudentModulePreferences>({
  broadcastKey: "students",
  getByWorkspace: getStudentModulePreferencesByWorkspace,
  upsert: upsertStudentModulePreferences,
  normalize: normalizeStudentModulePreferences,
});

export const loadStudentModulePreferences = service.load;
export const saveStudentModulePreferences = service.save;
