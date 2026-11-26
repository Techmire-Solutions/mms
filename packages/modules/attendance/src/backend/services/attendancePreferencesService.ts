import {
  normalizeAttendanceModulePreferences,
  type AttendanceModulePreferences,
} from "@mms/contracts";
import {
  getAttendanceModulePreferences,
  setAttendanceModulePreferences,
} from "../repository/db/attendanceModulePreferencesRepository.js";
import { createModulePreferencesService } from "@mms/be-core/data/module-preferences";

const service = createModulePreferencesService<AttendanceModulePreferences>({
  broadcastKey: "attendance",
  getByWorkspace: getAttendanceModulePreferences,
  upsert: setAttendanceModulePreferences,
  normalize: normalizeAttendanceModulePreferences,
});

export const getAttendancePreferencesService = service.load;
export const updateAttendancePreferencesService = service.save;
