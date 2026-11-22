/**
 * Messaging contract-driven server-state surface: query option factories.
 * React hook mutators come from the live `@/hooks/useMessaging` layer — this
 * module never duplicates them (mms-dry §1: no parallel data surface).
 */
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { MESSAGING_LOGS_QUERY_KEY, MESSAGING_METRICS_QUERY_KEY } from "@/hooks/useMessaging";
import type { MessagingMetricsDto } from "@mms/shared";
import { assertContractOk } from "@/lib/apiContractError";

export function messagingLogsListQueryOptions(
  query: {
    page?: number;
    limit?: number;
    search?: string;
    channel?: string;
    category?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    [key: string]: unknown;
  } = {},
) {
  return queryOptions({
    queryKey: [...MESSAGING_LOGS_QUERY_KEY, "contract", query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.messaging.listLogs({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to fetch message logs");
      return response.body;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function messagingCommandMetricsQueryOptions(options?: {
  startDate?: string;
  endDate?: string;
}) {
  const startDate = options?.startDate?.trim() || undefined;
  const endDate = options?.endDate?.trim() || undefined;
  // The KPI endpoint takes real `startDate`/`endDate` query params (not a
  // single `date` bound), and a dated key keeps the cache honest when the
  // reports tier narrows the range.
  const queryKey =
    startDate || endDate
      ? [...MESSAGING_METRICS_QUERY_KEY, startDate, endDate]
      : MESSAGING_METRICS_QUERY_KEY;

  return queryOptions({
    queryKey,
    queryFn: async ({ signal }) => {
      const response = await apiContract.messaging.getMetrics({
        query: {
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        },
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to load messaging metrics");
      return (response.body as { metrics?: MessagingMetricsDto }).metrics;
    },
    staleTime: 15_000,
  });
}
