import {
  normalizeAttendanceModulePreferences,
  type AttendanceModulePreferences,
} from "@mms/shared";
import {
  getAttendanceModulePreferences,
  setAttendanceModulePreferences,
} from "../db/repositories/attendanceModulePreferencesRepository.js";
import { createModulePreferencesService } from "../lib/createModulePreferencesService.js";

const service = createModulePreferencesService<AttendanceModulePreferences>({
  broadcastKey: "attendance",
  getByWorkspace: getAttendanceModulePreferences,
  upsert: setAttendanceModulePreferences,
  normalize: normalizeAttendanceModulePreferences,
});

export const getAttendancePreferencesService = service.load;
export const updateAttendancePreferencesService = service.save;
