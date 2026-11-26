type CalendarStore = typeof import("../repository/db/academicCalendarRepository.js");
type DayContextStore = typeof import("../repository/db/instructionalDayContext.js");
type PlacementStore = typeof import("../deps.js");
type LeaveStore = typeof import("../repository/db/attendanceLeaveRepository.js");
type SubmissionStore = typeof import("../repository/db/attendanceDaySubmissionRepository.js");
type LeaveWorkflowStore = typeof import("../repository/db/attendanceLeaveSyncRepository.js");
type PreferencesStore = typeof import("../repository/db/attendanceModulePreferencesRepository.js");

export type { AcademicCalendarRange } from "../repository/db/academicCalendarRepository.js";
export type { AttendanceDaySubmissionRow as AttendanceDaySubmission } from "../repository/db/attendanceDaySubmissionRepository.js";

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
