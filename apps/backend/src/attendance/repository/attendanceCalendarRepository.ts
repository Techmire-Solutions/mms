type CalendarStore = typeof import("../../db/repositories/academicCalendarRepository.js");
type DayContextStore = typeof import("../../db/repositories/instructionalDayContext.js");
type PlacementStore = typeof import("../../db/repositories/enrollmentPlacementLookup.js");
type LeaveStore = typeof import("../../db/repositories/attendanceLeaveRepository.js");
type SubmissionStore = typeof import("../../db/repositories/attendanceDaySubmissionRepository.js");
type LeaveWorkflowStore = typeof import("../../db/repositories/attendanceLeaveSyncRepository.js");
type PreferencesStore =
  typeof import("../../db/repositories/attendanceModulePreferencesRepository.js");

export type { AcademicCalendarRange } from "../../db/repositories/academicCalendarRepository.js";
export type { AttendanceDaySubmissionRow as AttendanceDaySubmission } from "../../db/repositories/attendanceDaySubmissionRepository.js";

/**
 * Storage gateway for the Attendance academic calendar and teaching-day rules
 * (holidays, make-up days, working days, section-of-record stamping).
 */
export interface AttendanceCalendarRepository {
  listAcademicCalendarEvents: CalendarStore["listAcademicCalendarEvents"];
  saveAcademicCalendarEvent: CalendarStore["saveAcademicCalendarEvent"];
  softDeleteAcademicCalendarEvent: CalendarStore["softDeleteAcademicCalendarEvent"];
  restoreAcademicCalendarEvent: CalendarStore["restoreAcademicCalendarEvent"];
  loadInstructionalDayContext: DayContextStore["loadInstructionalDayContext"];
  listEnrollmentPlacements: PlacementStore["listEnrollmentPlacements"];
  listEnrollmentPlacementsAsOf: PlacementStore["listEnrollmentPlacementsAsOf"];
  /** Every distinct attendance date at once — replaces the per-date loop in the stamping path. */
  listEnrollmentPlacementsForDates: PlacementStore["listEnrollmentPlacementsForDates"];
  findWorkspaceTimezone: (tenant: string) => Promise<string | null>;
  getAttendanceModulePreferences: PreferencesStore["getAttendanceModulePreferences"];
  findOverlappingApprovedLeaves: LeaveStore["findOverlappingApprovedLeaves"];
  insertApprovedLeave: LeaveStore["insertApprovedLeave"];
  insertApprovedLeaveIfFree: LeaveStore["insertApprovedLeaveIfFree"];
  listApprovedLeavesFor: LeaveStore["listApprovedLeavesFor"];
  lockAttendanceStudents: LeaveWorkflowStore["lockAttendanceStudents"];
  listLockedAttendanceDayKeys: SubmissionStore["listLockedAttendanceDayKeys"];
  getAttendanceDaySubmission: SubmissionStore["getAttendanceDaySubmission"];
  upsertAttendanceDaySubmission: SubmissionStore["upsertAttendanceDaySubmission"];
  reopenAttendanceDay: SubmissionStore["reopenAttendanceDay"];
}
