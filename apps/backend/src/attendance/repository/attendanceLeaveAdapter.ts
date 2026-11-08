import type { AttendanceLeaveRepository } from "./attendanceLeaveRepository.js";

export type { AttendanceLeaveRecord, ExcusedAttendanceRow } from "./attendanceLeaveRepository.js";
import {
  cancelAttendanceLeave,
  decideAttendanceLeave,
  findAttendanceLeaveById,
  insertPendingLeave,
  listAttendanceLeaves,
} from "../../db/repositories/attendanceLeaveWorkflowRepository.js";
import {
  excuseAbsencesInRange,
  lockAttendanceStudents,
} from "../../db/repositories/attendanceLeaveSyncRepository.js";

/** Drizzle-backed adapter for {@link AttendanceLeaveRepository}. */
export const attendanceLeaveRepository: AttendanceLeaveRepository = {
  listAttendanceLeaves,
  findAttendanceLeaveById,
  insertPendingLeave,
  decideAttendanceLeave,
  cancelAttendanceLeave,
  excuseAbsencesInRange,
  lockAttendanceStudents,
};
