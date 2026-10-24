type CalendarStore = typeof import("../../db/repositories/academicCalendarRepository.js");
type DayContextStore = typeof import("../../db/repositories/instructionalDayContext.js");
type PlacementStore = typeof import("../../db/repositories/enrollmentPlacementLookup.js");
type LeaveStore = typeof import("../../db/repositories/attendanceLeaveRepository.js");
type PreferencesStore =
  typeof import("../../db/repositories/attendanceModulePreferencesRepository.js");

export type { AcademicCalendarRange } from "../../db/repositories/academicCalendarRepository.js";

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
  getAttendanceModulePreferences: PreferencesStore["getAttendanceModulePreferences"];
  findOverlappingApprovedLeaves: LeaveStore["findOverlappingApprovedLeaves"];
  insertApprovedLeave: LeaveStore["insertApprovedLeave"];
}
