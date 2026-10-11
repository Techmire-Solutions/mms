import type { QueryClient } from "@tanstack/react-query";
import {
  ENROLLMENTS_METRICS_QUERY_KEY,
  ENROLLMENTS_QUERY_KEY,
  ENROLLMENTS_REPORT_AGGREGATES_QUERY_KEY,
  ENROLLMENTS_WIDGET_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/enrollments/hooks/useEnrollmentsApi";

/** Invalidate Enrollments list/metrics/widget-aggregates/report-aggregates/setup Query keys. */
export function invalidateEnrollmentsQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ENROLLMENTS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ENROLLMENTS_METRICS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ENROLLMENTS_WIDGET_AGGREGATES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ENROLLMENTS_REPORT_AGGREGATES_QUERY_KEY });
}
