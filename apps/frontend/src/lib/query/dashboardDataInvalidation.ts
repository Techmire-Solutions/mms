import type { QueryClient } from "@tanstack/react-query";
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "./dashboardQueryKeys";
import { DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY } from "./dynamicWidgetAggregatesQueryKey";

/**
 * Invalidates the dashboard *data* that module writes feed: the composite summary
 * and the reports dynamic-widget aggregates. Kept in a keys-only module so module
 * invalidators (Finance/Accounting) can import it without pulling the dashboard
 * setup screens, their API client or auth context into the import graph.
 */
export function invalidateDashboardDataQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY_ROOT });
  void queryClient.invalidateQueries({ queryKey: DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY });
}
