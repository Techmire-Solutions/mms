import type { AttendanceCalendarRepository } from "./attendanceCalendarRepository.js";
import {
  listAcademicCalendarEvents,
  restoreAcademicCalendarEvent,
  saveAcademicCalendarEvent,
  softDeleteAcademicCalendarEvent,
} from "../../db/repositories/academicCalendarRepository.js";
import { loadInstructionalDayContext } from "../../db/repositories/instructionalDayContext.js";
import { listEnrollmentPlacements } from "../../db/repositories/enrollmentPlacementLookup.js";
import {
  findOverlappingApprovedLeaves,
  insertApprovedLeave,
} from "../../db/repositories/attendanceLeaveRepository.js";
import { getAttendanceModulePreferences } from "../../db/repositories/attendanceModulePreferencesRepository.js";

/** Drizzle-backed adapter for {@link AttendanceCalendarRepository}. */
export const attendanceCalendarRepository: AttendanceCalendarRepository = {
  listAcademicCalendarEvents,
  saveAcademicCalendarEvent,
  softDeleteAcademicCalendarEvent,
  restoreAcademicCalendarEvent,
  loadInstructionalDayContext,
  listEnrollmentPlacements,
  getAttendanceModulePreferences,
  findOverlappingApprovedLeaves,
  insertApprovedLeave,
};
