import { createModuleQueryInvalidator } from "@mms/fe-core/query/createModuleQueryInvalidator";
import {
  SESSION_ACTIVITY_QUERY_KEY,
  SESSION_COMPLETION_QUERY_KEY,
  SESSION_DETAIL_QUERY_KEY,
  SESSION_ROLLOVER_RUNS_QUERY_KEY,
} from "@mms/fe-core/lib/sessionQueryKeys";
import { SESSIONS_LOOKUPS_QUERY_KEY } from "./useSessionLookups";
import { SESSIONS_PREFERENCES_QUERY_KEY } from "./useSessionSetupConfig";
import {
  SESSIONS_METRICS_QUERY_KEY,
  SESSIONS_QUERY_KEY,
  SESSIONS_REPORT_AGGREGATES_QUERY_KEY,
  SESSIONS_WIDGET_AGGREGATES_QUERY_KEY,
} from "./sessionsQueryKeys.js";

/**
 * Invalidate every Sessions cache family: list + detail + activity + completion + rollover runs,
 * reports/metrics/widgets, setup preferences, and lookups. Prefix keys also cover paged/detail
 * query variants.
 */
export const invalidateSessionsQueries = createModuleQueryInvalidator({
  list: SESSIONS_QUERY_KEY,
  lists: [
    SESSION_DETAIL_QUERY_KEY,
    SESSION_ACTIVITY_QUERY_KEY,
    SESSION_COMPLETION_QUERY_KEY,
    SESSION_ROLLOVER_RUNS_QUERY_KEY,
    SESSIONS_REPORT_AGGREGATES_QUERY_KEY,
  ],
  metrics: SESSIONS_METRICS_QUERY_KEY,
  widgetAggregates: SESSIONS_WIDGET_AGGREGATES_QUERY_KEY,
  preferences: SESSIONS_PREFERENCES_QUERY_KEY,
  lookups: SESSIONS_LOOKUPS_QUERY_KEY,
});
