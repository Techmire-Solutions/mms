import type { QueryClient } from "@tanstack/react-query";
import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import { DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY } from "@/lib/query/dynamicWidgetAggregatesQueryKey";
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@/lib/query/dashboardQueryKeys";
import {
  EXAMINATIONS_ELIGIBILITY_QUERY_KEY,
  EXAMINATIONS_EXAMS_QUERY_KEY,
  EXAMINATIONS_METRICS_QUERY_KEY,
  EXAMINATIONS_REPORT_AGGREGATES_QUERY_KEY,
  EXAMINATIONS_RESULTS_QUERY_KEY,
} from "@/tenant/features/examinations/hooks/examinationsQueryKeys";
import { EXAMINATIONS_PREFERENCES_QUERY_KEY } from "@/tenant/features/examinations/hooks/useExaminationSetupConfig";

/**
 * Invalidate every Examinations-owned query after a mutation.
 *
 * Besides the exams/results lists, analytics, metrics and setup, this covers the eligibility
 * panel (attendance-gate/roster states) and the cross-module dashboard surfaces: dynamic report
 * widgets and the composite dashboard summary. Marking/publishing used to leave the dashboard
 * exam widgets and the eligibility panel stale until an unrelated refetch.
 */
const invalidateOwnedExaminationsQueries = createModuleQueryInvalidator({
  list: EXAMINATIONS_EXAMS_QUERY_KEY,
  lists: [
    EXAMINATIONS_RESULTS_QUERY_KEY,
    EXAMINATIONS_REPORT_AGGREGATES_QUERY_KEY,
    EXAMINATIONS_ELIGIBILITY_QUERY_KEY,
  ],
  metrics: EXAMINATIONS_METRICS_QUERY_KEY,
  widgetAggregates: DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY,
  preferences: EXAMINATIONS_PREFERENCES_QUERY_KEY,
});

export function invalidateExaminationsQueries(queryClient: QueryClient): void {
  invalidateOwnedExaminationsQueries(queryClient);
  // The shared invalidator has no dashboard slot; exam status/pass-rate cards are part of the
  // composite summary, so refresh it explicitly (live push does the same cross-client).
  void queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY_ROOT });
}
