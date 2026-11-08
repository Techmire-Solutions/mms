import type { AttendanceCalendarRepository } from "./attendanceCalendarRepository.js";
import {
  listAcademicCalendarEvents,
  restoreAcademicCalendarEvent,
  saveAcademicCalendarEvent,
  softDeleteAcademicCalendarEvent,
} from "../../db/repositories/academicCalendarRepository.js";
import { loadInstructionalDayContext } from "../../db/repositories/instructionalDayContext.js";
import {
  listEnrollmentPlacements,
  listEnrollmentPlacementsAsOf,
} from "../../db/repositories/enrollmentPlacementLookup.js";
import {
  findOverlappingApprovedLeaves,
  insertApprovedLeave,
  insertApprovedLeaveIfFree,
  listApprovedLeavesFor,
} from "../../db/repositories/attendanceLeaveRepository.js";
import {
  getAttendanceDaySubmission,
  listLockedAttendanceDayKeys,
  reopenAttendanceDay,
  upsertAttendanceDaySubmission,
} from "../../db/repositories/attendanceDaySubmissionRepository.js";
import { getAttendanceModulePreferences } from "../../db/repositories/attendanceModulePreferencesRepository.js";
import { findWorkspaceTimezone } from "../../db/repositories/workspaceRepository.js";

/** Drizzle-backed adapter for {@link AttendanceCalendarRepository}. */
export const attendanceCalendarRepository: AttendanceCalendarRepository = {
  listAcademicCalendarEvents,
  saveAcademicCalendarEvent,
  softDeleteAcademicCalendarEvent,
  restoreAcademicCalendarEvent,
  loadInstructionalDayContext,
  listEnrollmentPlacements,
  listEnrollmentPlacementsAsOf,
  findWorkspaceTimezone,
  getAttendanceModulePreferences,
  findOverlappingApprovedLeaves,
  insertApprovedLeave,
  insertApprovedLeaveIfFree,
  listApprovedLeavesFor,
  listLockedAttendanceDayKeys,
  getAttendanceDaySubmission,
  upsertAttendanceDaySubmission,
  reopenAttendanceDay,
};
