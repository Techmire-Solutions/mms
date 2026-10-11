import type { AttendanceRepository } from "./attendanceRepository.js";
import {
  listAttendanceRecordsByWorkspace,
  findAttendanceRecordById,
  findAttendanceRecordsByIds,
  saveAttendanceRecord,
  bulkSaveAttendanceRecords,
  replaceAttendanceRecordsForWorkspace,
  bulkSoftDeleteAttendanceRecords,
  bulkRestoreAttendanceRecords,
} from "../../db/repositories/attendanceRepository.js";
import {
  listAttendancePage,
  countAttendanceActiveByWorkspace,
  aggregateAttendanceCommandMetrics,
} from "../../db/repositories/attendanceRepositoryList.js";
import { loadAttendanceReportAggregatesSql } from "../../db/repositories/attendanceRepositoryReport.js";
import { aggregateAttendanceWidgetQueries } from "../../db/repositories/attendanceRepositoryWidgets.js";

/**
 * Drizzle-backed adapter for {@link AttendanceRepository}. Delegates to the
 * existing concrete repository functions (no SQL rewrite in this pass).
 */
export const attendanceRepository: AttendanceRepository = {
  listAttendanceRecordsByWorkspace,
  findAttendanceRecordById,
  findAttendanceRecordsByIds,
  saveAttendanceRecord,
  bulkSaveAttendanceRecords,
  replaceAttendanceRecordsForWorkspace,
  listAttendancePage,
  countAttendanceActiveByWorkspace,
  aggregateAttendanceCommandMetrics,
  aggregateAttendanceWidgetQueries,
  loadAttendanceReportAggregates: loadAttendanceReportAggregatesSql,
  bulkSoftDeleteAttendanceRecords,
  bulkRestoreAttendanceRecords,
};
