import { useQueryClient } from "@tanstack/react-query";
import {
  MESSAGE_LOGS_DEFAULT_PAGE_SIZE,
  type Message,
  type MessageLogCreateDto,
  type MessageTemplate,
} from "@mms/shared";
import { tsrClient } from "@/lib/api";
import { notifyApiFailure } from "@/lib/apiErrorNotify";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";

export const MESSAGING_TEMPLATES_QUERY_KEY = ["messaging", "templates"] as const;
export const MESSAGING_LOGS_QUERY_KEY = ["messaging", "logs"] as const;
export const MESSAGING_METRICS_QUERY_KEY = ["messaging", "metrics"] as const;

export interface MessageLogsPageResult {
  logs: Message[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface RecordDispatchesInput {
  logs: MessageLogCreateDto[];
  /** Final per-batch key from the caller (already chunked); forwarded unchanged. */
  idempotencyKey?: string;
}

export function useMessageTemplates(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  const query = tsrClient.messaging.listTemplates.useQuery({
    queryKey: MESSAGING_TEMPLATES_QUERY_KEY,
    queryData: { query: {} },
    staleTime: 30_000,
    enabled: options?.enabled !== false && isAuthenticated,
  });

  const templates =
    query.data?.status === 200
      ? ((query.data.body as { templates?: MessageTemplate[] } | null)?.templates ?? [])
      : [];

  return { ...query, templates };
}

export function useMessageLogs(options?: {
  enabled?: boolean;
  channel?: string;
  category?: string;
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const { isAuthenticated } = useAuth();
  const page = options?.page && options.page > 0 ? options.page : 1;
  const pageSize =
    options?.pageSize && options.pageSize > 0 ? options.pageSize : MESSAGE_LOGS_DEFAULT_PAGE_SIZE;

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const query = tsrClient.messaging.listLogs.useQuery({
    queryKey: [
      ...MESSAGING_LOGS_QUERY_KEY,
      options?.channel,
      options?.category,
      options?.search,
      options?.status,
      options?.startDate,
      options?.endDate,
      page,
      pageSize,
    ],
    queryData: {
      query: {
        page,
        pageSize,
        ...(options?.channel && options.channel !== "all" ? { channel: options.channel } : {}),
        ...(options?.category && options.category !== "all" ? { category: options.category } : {}),
        ...(options?.search?.trim() ? { search: options.search.trim() } : {}),
        ...(options?.status && options.status !== "all" ? { status: options.status } : {}),
        ...(options?.startDate?.trim() ? { startDate: options.startDate.trim() } : {}),
        ...(options?.endDate?.trim() ? { endDate: options.endDate.trim() } : {}),
      },
    },
    staleTime: 15_000,
    enabled: options?.enabled !== false && isAuthenticated,
    placeholderData: (previous: unknown) => previous,
  });

  const res = (query.data?.status === 200 ? query.data.body : {}) as {
    logs?: Message[];
    total?: number;
    page?: number;
    pageSize?: number;
    hasMore?: boolean;
  };

  return {
    ...query,
    logs: res.logs ?? [],
    total: res.total ?? res.logs?.length ?? 0,
    page: res.page ?? page,
    pageSize: res.pageSize ?? pageSize,
    hasMore: Boolean(res.hasMore),
  };
}

export function useMessagingMetrics(options?: {
  enabled?: boolean;
  startDate?: string;
  endDate?: string;
}) {
  const { isAuthenticated } = useAuth();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.messaging.getMetrics.useQuery({
    queryKey: [...MESSAGING_METRICS_QUERY_KEY, options?.startDate, options?.endDate],
    queryData: {
      query: {
        startDate: options?.startDate?.trim() || undefined,
        endDate: options?.endDate?.trim() || undefined,
      },
    },
    staleTime: 15_000,
    enabled: options?.enabled !== false && isAuthenticated,
  });
}

export function useMessagingMutations() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: MESSAGING_TEMPLATES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: MESSAGING_LOGS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: MESSAGING_METRICS_QUERY_KEY });
  };

  const onError = (error: unknown) => {
    notifyApiFailure(error, t);
  };

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const saveTemplate = tsrClient.messaging.saveTemplate.useMutation({
    onSuccess: () => invalidate(),
    onError,
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const deleteTemplate = tsrClient.messaging.deleteTemplate.useMutation({
    onSuccess: () => invalidate(),
    onError,
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const recordDispatches = tsrClient.messaging.recordLogs.useMutation({
    onSuccess: () => invalidate(),
    onError,
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const clearLogs = tsrClient.messaging.clearLogs.useMutation({
    onSuccess: () => invalidate(),
    onError,
  });

  return {
    saveTemplate,
    deleteTemplate: {
      ...deleteTemplate,
      mutateAsync: (id: string) =>
        (deleteTemplate.mutateAsync as (arg: { params: { id: string } }) => Promise<unknown>)({
          params: { id },
        }),
    },
    recordDispatches,
    clearLogs: {
      ...clearLogs,
      mutateAsync: () =>
        (clearLogs.mutateAsync as (arg: { body: Record<string, never> }) => Promise<unknown>)({
          body: {},
        }),
    },
  };
}
