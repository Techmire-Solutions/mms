import type { QueryClient } from "@tanstack/react-query";
import { attendanceQueryKeys } from "./attendanceQueryKeys.js";
import { DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY } from "@/lib/query/dynamicWidgetAggregatesQueryKey";
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@/lib/query/dashboardQueryKeys";

/**
 * Invalidate every attendance-owned query after a mutation.
 *
 * `attendanceQueryKeys.all` covers list/roster/metrics/report-aggregates/lifecycle/lookups/
 * preferences/coverage by prefix. The two cross-module roots are invalidated explicitly: the
 * dashboard KPIs and report widgets must refresh even when the websocket push is unavailable — before
 * this, only the live-push dispatcher touched them, so a dropped socket left stale class-overview
 * numbers after marking.
 */
export function invalidateAttendanceQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY_ROOT });
}
