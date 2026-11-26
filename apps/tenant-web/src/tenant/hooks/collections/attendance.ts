/**
 * Cross-module public surface for Attendance Query hooks.
 * Other features and shared UI must import from here — not `@/tenant/features/attendance/hooks/*`.
 */
export {
  ATTENDANCE_QUERY_KEY,
  ATTENDANCE_METRICS_QUERY_KEY,
  ATTENDANCE_REPORT_AGGREGATES_QUERY_KEY,
  attendanceCommandMetricsQueryOptions,
  useAttendancePaginated,
  useAttendanceRecords,
  useAttendanceRecordsCollection,
  useAttendanceReportAggregates,
  useAttendanceMutations,
  useAttendanceMetrics,
} from "@mms/mod-attendance/frontend/tenant/hooks/useAttendance";
export { invalidateAttendanceQueries } from "@mms/mod-attendance/frontend/tenant/hooks/invalidateAttendanceQueries";
export {
  useComposedAttendanceSettings,
  useAttendancePreferencesMutation,
  useAttendancePreferencesQuery,
  ATTENDANCE_PREFERENCES_QUERY_KEY,
} from "@mms/mod-attendance/frontend/tenant/hooks/useAttendanceSetupConfig";
export { useAttendanceLookupsQuery } from "@mms/mod-attendance/frontend/tenant/hooks/useAttendanceLookups";
// Contract-driven tsrClient hooks & query factories
export {
  attendanceListQueryOptions,
  useAttendanceContractList,
  useAttendanceContractCreate,
  useAttendanceContractBulk,
  useAttendanceContractBulkDelete,
  useAttendanceContractBulkRestore,
  useAttendanceContractUpdate,
  useAttendanceContractDelete,
} from "@mms/mod-attendance/frontend/tenant/hooks/useAttendance";
export { applyAttendanceWorkDrillDown } from "@mms/mod-attendance/frontend/tenant/hooks/attendanceWorkDrillDown";
