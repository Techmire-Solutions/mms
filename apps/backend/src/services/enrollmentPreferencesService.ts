import {
  normalizeEnrollmentModulePreferences,
  type EnrollmentModulePreferences,
} from "@mms/shared";
import {
  getEnrollmentModulePreferencesByWorkspace,
  upsertEnrollmentModulePreferences,
} from "../db/repositories/enrollmentModulePreferencesRepository.js";
import { createModulePreferencesService } from "../lib/createModulePreferencesService.js";

const service = createModulePreferencesService<EnrollmentModulePreferences>({
  broadcastKey: "enrollments",
  getByWorkspace: getEnrollmentModulePreferencesByWorkspace,
  upsert: upsertEnrollmentModulePreferences,
  normalize: normalizeEnrollmentModulePreferences,
});

export const loadEnrollmentModulePreferences = service.load;
export const saveEnrollmentModulePreferences = service.save;
