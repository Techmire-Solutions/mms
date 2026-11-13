/**
 * Cross-module public surface for Dashboard Query hooks.
 * Other features and shared UI must import from here — not `@/tenant/features/dashboard/hooks/*`.
 */
export {
  DASHBOARD_PREFERENCES_QUERY_KEY,
  DASHBOARD_WIDGETS_QUERY_KEY,
  DASHBOARD_SUMMARY_QUERY_KEY,
  DASHBOARD_SUMMARY_QUERY_KEY_ROOT,
  invalidateDashboardConfigQueries,
  seedDashboardWidgets,
  useDashboardPreferencesQuery,
  useDashboardPreferencesMutation,
  useDashboardWidgetsQuery,
  useDashboardWidgetsMutation,
  useDashboardWidgetDeleteMutation,
  useDashboardWidgetsReorderMutation,
  useDashboardSummaryQuery,
} from "@/tenant/features/dashboard/hooks/useDashboardSetupConfig";
export { invalidateDashboardDataQueries } from "@/lib/query/dashboardDataInvalidation";
export { useDashboardData } from "@/tenant/features/dashboard/hooks/useDashboardData";
export { percentChange } from "@/tenant/features/dashboard/hooks/dashboardMetricTrends";
