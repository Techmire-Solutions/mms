import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import { SESSIONS_LOOKUPS_QUERY_KEY } from "@/tenant/features/sessions/hooks/useSessionLookups";
import { SESSIONS_PREFERENCES_QUERY_KEY } from "@/tenant/features/sessions/hooks/useSessionSetupConfig";
import {
  SESSIONS_METRICS_QUERY_KEY,
  SESSIONS_QUERY_KEY,
  SESSIONS_REPORT_AGGREGATES_QUERY_KEY,
  SESSIONS_WIDGET_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/sessions/hooks/useSessions";

/** Invalidate Sessions list/metrics/widget-aggregates/report-aggregates/setup/lookups Query keys. */
export const invalidateSessionsQueries = createModuleQueryInvalidator({
  list: SESSIONS_QUERY_KEY,
  lists: [SESSIONS_REPORT_AGGREGATES_QUERY_KEY],
  metrics: SESSIONS_METRICS_QUERY_KEY,
  widgetAggregates: SESSIONS_WIDGET_AGGREGATES_QUERY_KEY,
  preferences: SESSIONS_PREFERENCES_QUERY_KEY,
  lookups: SESSIONS_LOOKUPS_QUERY_KEY,
});
