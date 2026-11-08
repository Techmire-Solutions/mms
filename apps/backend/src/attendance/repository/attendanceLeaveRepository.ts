type WorkflowStore = typeof import("../../db/repositories/attendanceLeaveWorkflowRepository.js");
type SyncStore = typeof import("../../db/repositories/attendanceLeaveSyncRepository.js");

export type { AttendanceLeaveWorkflowRow as AttendanceLeaveRecord } from "../../db/repositories/attendanceLeaveWorkflowRepository.js";
export type { ExcusedAttendanceRow } from "../../db/repositories/attendanceLeaveSyncRepository.js";

/**
 * Port for the excuse / leave workflow (submit → review → approve/reject → cancel) and the
 * retroactive mark synchronisation an approval performs.
 *
 * Kept separate from the calendar port: this is a workflow with transitions, not calendar data.
 */
export interface AttendanceLeaveRepository {
  listAttendanceLeaves: WorkflowStore["listAttendanceLeaves"];
  findAttendanceLeaveById: WorkflowStore["findAttendanceLeaveById"];
  insertPendingLeave: WorkflowStore["insertPendingLeave"];
  decideAttendanceLeave: WorkflowStore["decideAttendanceLeave"];
  cancelAttendanceLeave: WorkflowStore["cancelAttendanceLeave"];
  excuseAbsencesInRange: SyncStore["excuseAbsencesInRange"];
  lockAttendanceStudents: SyncStore["lockAttendanceStudents"];
}
