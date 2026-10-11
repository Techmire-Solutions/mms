/**
 * Phase 7: Contract-driven query/mutation hooks for the Messaging module.
 * Uses tsrClient (@ts-rest/react-query v5) for contract schema enforcement.
 */
import { apiContract, tsrClient } from "@/lib/api";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { serverMetricsQueryOptions } from "@/hooks/useServerMetrics";
import { MESSAGING_MODULE_MANIFEST, type MessagingMetricsDto } from "@mms/shared";
import {
  MESSAGING_TEMPLATES_QUERY_KEY,
  MESSAGING_LOGS_QUERY_KEY,
} from "@/tenant/features/messaging/hooks/useMessaging";
import { invalidateMessagingQueries } from "@/tenant/features/messaging/hooks/invalidateMessagingQueries";

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

export function useMessagingContractListLogs(
  query: { page?: number; limit?: number; search?: string; [key: string]: unknown },
  enabled = true,
) {
  return tsrClient.messaging.listLogs.useQuery({
    queryKey: [...MESSAGING_LOGS_QUERY_KEY, "contract", query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useMessagingContractListTemplates(
  query: { page?: number; limit?: number; search?: string; [key: string]: unknown } = {},
  enabled = true,
) {
  return tsrClient.messaging.listTemplates.useQuery({
    queryKey: [...MESSAGING_TEMPLATES_QUERY_KEY, "contract", query],
    queryData: { query },
    staleTime: 30_000,
    enabled,
  });
}

export function useMessagingContractListRecipients(
  query: { page?: number; limit?: number; search?: string; [key: string]: unknown } = {},
  enabled = true,
) {
  return tsrClient.messaging.listRecipients.useQuery({
    queryKey: ["messaging", "recipients", "contract", query],
    queryData: { query },
    staleTime: 30_000,
    enabled,
  });
}

export function useMessagingContractSaveTemplate() {
  const queryClient = useQueryClient();
  return tsrClient.messaging.saveTemplate.useMutation({
    onSuccess: () => invalidateMessagingQueries(queryClient),
  });
}

export function useMessagingContractDeleteTemplate() {
  const queryClient = useQueryClient();
  return tsrClient.messaging.deleteTemplate.useMutation({
    onSuccess: () => invalidateMessagingQueries(queryClient),
  });
}

export function useMessagingContractRecordLogs() {
  const queryClient = useQueryClient();
  return tsrClient.messaging.recordLogs.useMutation({
    onSuccess: () => invalidateMessagingQueries(queryClient),
  });
}

export function useMessagingContractClearLogs() {
  const queryClient = useQueryClient();
  return tsrClient.messaging.clearLogs.useMutation({
    onSuccess: () => invalidateMessagingQueries(queryClient),
  });
}
