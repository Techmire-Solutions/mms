import { loadAttendanceReportAggregatesSql } from "./repository/db/attendanceRepositoryReport.js";
import { listAttendancePage } from "./repository/db/attendanceRepositoryList.js";

/** Public directory surface for other modules (finance, reports). */
export const attendanceService = {
  loadAttendanceReportAggregatesSql,
  listAttendancePage,
};
