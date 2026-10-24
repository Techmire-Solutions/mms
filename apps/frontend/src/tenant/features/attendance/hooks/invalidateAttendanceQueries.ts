import type { QueryClient } from "@tanstack/react-query";
import {
  ATTENDANCE_METRICS_QUERY_KEY,
  ATTENDANCE_QUERY_KEY,
  ATTENDANCE_REPORT_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/attendance/hooks/useAttendance";

/** Invalidate Attendance list/metrics/report-aggregates Query keys (mutations + live push). */
export function invalidateAttendanceQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ATTENDANCE_METRICS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ATTENDANCE_REPORT_AGGREGATES_QUERY_KEY });
}
