import {
  normalizeEnrollmentModulePreferences,
  type EnrollmentModulePreferences,
} from "@mms/contracts";
import {
  getEnrollmentModulePreferencesByWorkspace,
  upsertEnrollmentModulePreferences,
} from "../repository/db/enrollmentModulePreferencesRepository.js";
import { createModulePreferencesService } from "@mms/be-core/data/module-preferences";

const service = createModulePreferencesService<EnrollmentModulePreferences>({
  broadcastKey: "enrollments",
  getByWorkspace: getEnrollmentModulePreferencesByWorkspace,
  upsert: upsertEnrollmentModulePreferences,
  normalize: normalizeEnrollmentModulePreferences,
});

export const loadEnrollmentModulePreferences = service.load;
export const saveEnrollmentModulePreferences = service.save;
