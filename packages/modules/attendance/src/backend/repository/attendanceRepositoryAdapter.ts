import type { AttendanceRepository } from "./attendanceRepository.js";
import {
  listAttendanceRecordsByWorkspace,
  findAttendanceRecordById,
  findAttendanceRecordsByIds,
  findAttendanceRecordsForStudentsOnDates,
  saveAttendanceRecord,
  saveAttendanceRecordById,
  bulkSaveAttendanceRecords,
  replaceAttendanceRecordsForWorkspace,
  bulkSoftDeleteAttendanceRecords,
  bulkRestoreAttendanceRecords,
} from "../repository/db/attendanceRepository.js";
import {
  countMatrixStudents,
  listMatrixMarks,
  listMatrixStudentsPage,
} from "../repository/db/attendanceMatrixRepository.js";
import {
  listAttendancePage,
  listAttendanceRoster,
  countAttendanceActiveByWorkspace,
  aggregateAttendanceCommandMetrics,
} from "../repository/db/attendanceRepositoryList.js";
import { loadAttendanceReportAggregatesSql } from "../repository/db/attendanceRepositoryReport.js";
import { listMarkedAttendanceDatesSql } from "../repository/db/attendanceMarkedDates.js";
import { aggregateAttendanceWidgetQueries } from "../repository/db/attendanceRepositoryWidgets.js";

/**
 * Drizzle-backed adapter for {@link AttendanceRepository}. Delegates to the
 * existing concrete repository functions (no SQL rewrite in this pass).
 */
export const attendanceRepository: AttendanceRepository = {
  listAttendanceRecordsByWorkspace,
  findAttendanceRecordById,
  findAttendanceRecordsByIds,
  findAttendanceRecordsForStudentsOnDates,
  saveAttendanceRecord,
  saveAttendanceRecordById,
  bulkSaveAttendanceRecords,
  replaceAttendanceRecordsForWorkspace,
  listAttendancePage,
  listAttendanceRoster,
  countAttendanceActiveByWorkspace,
  aggregateAttendanceCommandMetrics,
  aggregateAttendanceWidgetQueries,
  loadAttendanceReportAggregates: loadAttendanceReportAggregatesSql,
  listMarkedAttendanceDates: listMarkedAttendanceDatesSql,
  bulkSoftDeleteAttendanceRecords,
  bulkRestoreAttendanceRecords,
  listMatrixStudentsPage,
  listMatrixMarks,
  countMatrixStudents,
};
