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
} from "@/tenant/features/attendance/hooks/useAttendance";
export { invalidateAttendanceQueries } from "@/tenant/features/attendance/hooks/invalidateAttendanceQueries";
export {
  useComposedAttendanceSettings,
  useAttendancePreferencesMutation,
  useAttendancePreferencesQuery,
  ATTENDANCE_PREFERENCES_QUERY_KEY,
} from "@/tenant/features/attendance/hooks/useAttendanceSetupConfig";
export { useAttendanceLookupsQuery } from "@/tenant/features/attendance/hooks/useAttendanceLookups";
// Phase 7: contract-driven tsrClient hooks & query factories
export {
  attendanceListQueryOptions,
  useAttendanceContractList,
  useAttendanceContractCreate,
  useAttendanceContractBulk,
  useAttendanceContractBulkDelete,
  useAttendanceContractBulkRestore,
  useAttendanceContractUpdate,
  useAttendanceContractDelete,
} from "@/tenant/features/attendance/hooks/useAttendanceTsrHooks";
export { applyAttendanceWorkDrillDown } from "@/tenant/features/attendance/hooks/attendanceWorkDrillDown";
