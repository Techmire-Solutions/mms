/**
 * Cross-module public surface for Sessions Query hooks.
 * Other features and shared UI must import from here — not `@/tenant/features/sessions/hooks/*`.
 */
export {
  SESSIONS_QUERY_KEY,
  SESSIONS_METRICS_QUERY_KEY,
  SESSIONS_WIDGET_AGGREGATES_QUERY_KEY,
  SESSIONS_REPORT_AGGREGATES_QUERY_KEY,
  sessionsCommandMetricsQueryOptions,
  useSessions,
  useSessionsPaginated,
  useSessionsCollection,
  useSessionsWidgetAggregates,
  useSessionsReportAggregates,
  useSessionMutations,
  useSessionsMetrics,
} from "@/tenant/features/sessions/hooks/useSessions";
export { invalidateSessionsQueries } from "@/tenant/features/sessions/hooks/invalidateSessionsQueries";
export {
  useComposedSessionsSettings,
  useSessionPreferencesMutation,
  useSessionPreferencesQuery,
  SESSIONS_PREFERENCES_QUERY_KEY,
} from "@/tenant/features/sessions/hooks/useSessionSetupConfig";
export { useSessionLookupsQuery } from "@/tenant/features/sessions/hooks/useSessionLookups";
// Contract-driven tsrClient hooks & query factories
export {
  sessionsListQueryOptions,
  useSessionsContractList,
  useSessionsContractCreate,
  useSessionsContractBulkDelete,
  useSessionsContractBulkStatus,
  useSessionsContractBulkRestore,
} from "@/tenant/features/sessions/hooks/useSessions";
