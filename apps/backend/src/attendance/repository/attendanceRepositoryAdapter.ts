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
} from "../../db/repositories/attendanceRepository.js";
import {
  listAttendancePage,
  listAttendanceRoster,
  countAttendanceActiveByWorkspace,
  aggregateAttendanceCommandMetrics,
} from "../../db/repositories/attendanceRepositoryList.js";
import { loadAttendanceReportAggregatesSql } from "../../db/repositories/attendanceRepositoryReport.js";
import { listMarkedAttendanceDatesSql } from "../../db/repositories/attendanceMarkedDates.js";
import { aggregateAttendanceWidgetQueries } from "../../db/repositories/attendanceRepositoryWidgets.js";

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
};
