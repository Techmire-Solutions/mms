/**
 * Cross-module public surface for Enrollments Query hooks.
 * Other features and shared UI must import from here — not `@/tenant/features/enrollments/hooks/*`.
 */
export {
  ENROLLMENTS_QUERY_KEY,
  ENROLLMENTS_METRICS_QUERY_KEY,
  ENROLLMENTS_REPORT_AGGREGATES_QUERY_KEY,
  ENROLLMENTS_WIDGET_AGGREGATES_QUERY_KEY,
} from "@mms/mod-enrollments/frontend/tenant/hooks/enrollmentsQueryKeys";
export {
  enrollmentsCommandMetricsQueryOptions,
  useEnrollments,
  useEnrollmentsPaginated,
  useEnrollmentsCollection,
  useEnrollmentMutations,
  useEnrollmentsMetrics,
  useEnrollmentsReportAggregates,
  useEnrollmentsWidgetAggregates,
} from "@mms/mod-enrollments/frontend/tenant/hooks/useEnrollmentsApi";
export { invalidateEnrollmentsQueries } from "@mms/mod-enrollments/frontend/tenant/hooks/invalidateEnrollmentsQueries";
export {
  useComposedEnrollmentsSettings,
  useEnrollmentPreferencesMutation,
  useEnrollmentPreferencesQuery,
  ENROLLMENTS_PREFERENCES_QUERY_KEY,
} from "@mms/mod-enrollments/frontend/tenant/hooks/useEnrollmentSetupConfig";
// Phase 7: contract-driven tsrClient hooks & query factories
export {
  enrollmentsListQueryOptions,
  useEnrollmentsContractList,
  useEnrollmentsContractGet,
  useEnrollmentsContractCreate,
  useEnrollmentsContractUpdate,
  useEnrollmentsContractDelete,
  useEnrollmentsContractBulkDelete,
  useEnrollmentsContractBulkRestore,
} from "@mms/mod-enrollments/frontend/tenant/hooks/useEnrollmentsQueries";

export { applyEnrollmentsWorkDrillDown } from "@mms/mod-enrollments/frontend/tenant/hooks/enrollmentsWorkDrillDown";
