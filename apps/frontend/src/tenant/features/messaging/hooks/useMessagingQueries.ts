/**
 * Messaging contract-driven server-state surface: query option factories.
 * React hook mutators come from the live `@/hooks/useMessaging` layer — this
 * module never duplicates them (mms-dry §1: no parallel data surface).
 */
import { queryOptions } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { serverMetricsQueryOptions } from "@/hooks/useServerMetrics";
import { MESSAGING_LOGS_QUERY_KEY } from "@/hooks/useMessaging";
import { MESSAGING_MODULE_MANIFEST, type MessagingMetricsDto } from "@mms/shared";

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
      if (response.status !== 200) {
        throw new Error("Failed to fetch message logs");
      }
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function messagingCommandMetricsQueryOptions(options?: {
  startDate?: string;
  endDate?: string;
}) {
  return serverMetricsQueryOptions<MessagingMetricsDto>({
    moduleId: MESSAGING_MODULE_MANIFEST.moduleId,
    apiPath: MESSAGING_MODULE_MANIFEST.restBasePath,
    extraParam: options?.startDate
      ? `startDate=${encodeURIComponent(options.startDate)}`
      : undefined,
  });
}
