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
  useSessionDetail,
  useSessionsWidgetAggregates,
  useSessionsReportAggregates,
  useSessionMutations,
  useSessionsMetrics,
} from "./useSessions";
export { invalidateSessionsQueries } from "./invalidateSessionsQueries";
export {
  useComposedSessionsSettings,
  useSessionPreferencesMutation,
  useSessionPreferencesQuery,
  SESSIONS_PREFERENCES_QUERY_KEY,
} from "./useSessionSetupConfig";
export { useSessionLookupsQuery } from "./useSessionLookups";

export { sessionsListQueryOptions } from "./useSessions";
