import type { QueryClient } from "@tanstack/react-query";
import {
  MESSAGING_LOGS_QUERY_KEY,
  MESSAGING_METRICS_QUERY_KEY,
  MESSAGING_TEMPLATES_QUERY_KEY,
} from "@/hooks/useMessaging";

/** Invalidate messaging templates/logs/metrics Query keys (mutations + live push). */
export function invalidateMessagingQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: MESSAGING_TEMPLATES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: MESSAGING_LOGS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: MESSAGING_METRICS_QUERY_KEY });
}
