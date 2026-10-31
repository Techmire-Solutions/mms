import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import {
  ATTENDANCE_METRICS_QUERY_KEY,
  ATTENDANCE_QUERY_KEY,
  ATTENDANCE_REPORT_AGGREGATES_QUERY_KEY,
} from "./attendanceQueryKeys.js";
import { ATTENDANCE_LOOKUPS_QUERY_KEY } from "@/tenant/features/attendance/hooks/useAttendanceLookups";
import { ATTENDANCE_PREFERENCES_QUERY_KEY } from "@/tenant/features/attendance/hooks/useAttendanceSetupConfig";

/** Invalidate Attendance list/metrics/report-aggregates/setup/lookups Query keys. */
export const invalidateAttendanceQueries = createModuleQueryInvalidator({
  list: ATTENDANCE_QUERY_KEY,
  lists: [ATTENDANCE_REPORT_AGGREGATES_QUERY_KEY],
  metrics: ATTENDANCE_METRICS_QUERY_KEY,
  preferences: ATTENDANCE_PREFERENCES_QUERY_KEY,
  lookups: ATTENDANCE_LOOKUPS_QUERY_KEY,
});
