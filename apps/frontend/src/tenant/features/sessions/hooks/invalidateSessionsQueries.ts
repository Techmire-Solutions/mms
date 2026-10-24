import type { QueryClient } from "@tanstack/react-query";
import { SESSIONS_PREFERENCES_QUERY_KEY } from "@/tenant/features/sessions/hooks/useSessionSetupConfig";
import {
  SESSIONS_METRICS_QUERY_KEY,
  SESSIONS_QUERY_KEY,
  SESSIONS_REPORT_AGGREGATES_QUERY_KEY,
  SESSIONS_WIDGET_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/sessions/hooks/useSessions";

/** Invalidate Sessions list/metrics/widget-aggregates/report-aggregates/setup Query keys. */
export function invalidateSessionsQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: SESSIONS_METRICS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: SESSIONS_WIDGET_AGGREGATES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: SESSIONS_REPORT_AGGREGATES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: SESSIONS_PREFERENCES_QUERY_KEY });
}
