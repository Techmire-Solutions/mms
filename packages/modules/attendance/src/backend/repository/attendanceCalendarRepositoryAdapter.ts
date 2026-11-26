import type { AttendanceCalendarRepository } from "./attendanceCalendarRepository.js";
import {
  listAcademicCalendarEvents,
  restoreAcademicCalendarEvent,
  saveAcademicCalendarEvent,
  softDeleteAcademicCalendarEvent,
} from "../repository/db/academicCalendarRepository.js";
import { loadInstructionalDayContext } from "../repository/db/instructionalDayContext.js";
import {
  listEnrollmentPlacements,
  listEnrollmentPlacementsAsOf,
  listEnrollmentPlacementsForDates,
} from "../deps.js";
import {
  findOverlappingApprovedLeaves,
  insertApprovedLeave,
  insertApprovedLeaveIfFree,
  listApprovedLeavesFor,
} from "../repository/db/attendanceLeaveRepository.js";
import { lockAttendanceStudents as lockWorkflowStudents } from "../repository/db/attendanceLeaveSyncRepository.js";
import {
  getAttendanceDaySubmission,
  listLockedAttendanceDayKeys,
  reopenAttendanceDay,
  upsertAttendanceDaySubmission,
} from "../repository/db/attendanceDaySubmissionRepository.js";
import { getAttendanceModulePreferences } from "../repository/db/attendanceModulePreferencesRepository.js";
import { findWorkspaceTimezone } from "../deps.js";

/** Drizzle-backed adapter for {@link AttendanceCalendarRepository}. */
export const attendanceCalendarRepository: AttendanceCalendarRepository = {
  listAcademicCalendarEvents,
  saveAcademicCalendarEvent,
  softDeleteAcademicCalendarEvent,
  restoreAcademicCalendarEvent,
  loadInstructionalDayContext,
  listEnrollmentPlacements,
  listEnrollmentPlacementsAsOf,
  listEnrollmentPlacementsForDates,
  findWorkspaceTimezone,
  getAttendanceModulePreferences,
  findOverlappingApprovedLeaves,
  insertApprovedLeave,
  insertApprovedLeaveIfFree,
  listApprovedLeavesFor,
  lockAttendanceStudents: lockWorkflowStudents,
  listLockedAttendanceDayKeys,
  getAttendanceDaySubmission,
  upsertAttendanceDaySubmission,
  reopenAttendanceDay,
};
