import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  MESSAGE_LOGS_DEFAULT_PAGE_SIZE,
  type Message,
  type MessageLogCreateDto,
  type MessageTemplate,
  type MessagingMetricsDto,
} from "@mms/contracts";
import { tsrClient } from "@mms/fe-core/api/tsRest";
import { notifyApiFailure } from "@mms/fe-core/api/errorNotify";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { useTranslation } from "@mms/fe-core/i18n";
import { useMessagingDispatchMutations } from "@/hooks/useMessagingDispatch";

export const MESSAGING_TEMPLATES_QUERY_KEY = ["messaging", "templates"] as const;
export const MESSAGING_LOGS_QUERY_KEY = ["messaging", "logs"] as const;
export const MESSAGING_METRICS_QUERY_KEY = ["messaging", "metrics"] as const;

/** Invalidate messaging templates/logs/metrics Query keys (mutations + live push). */
export function invalidateMessagingQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: MESSAGING_TEMPLATES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: MESSAGING_LOGS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: MESSAGING_METRICS_QUERY_KEY });
}

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

const EMPTY_TEMPLATES: MessageTemplate[] = [];
const EMPTY_LOGS: Message[] = [];

/** Template list for the messaging composer (auth-gated, 30s stale time). */
export function useMessageTemplates(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const query = tsrClient.messaging.listTemplates.useQuery({
    queryKey: MESSAGING_TEMPLATES_QUERY_KEY,
    queryData: { query: {} },
    staleTime: 30_000,
    enabled: options?.enabled !== false && isAuthenticated,
  });

  const templates =
    query.data?.status === 200
      ? ((query.data.body as { templates?: MessageTemplate[] } | null)?.templates ??
        EMPTY_TEMPLATES)
      : EMPTY_TEMPLATES;

  return { ...query, templates };
}

/** Paginated message-log list with channel/category/status/date filters. */
export function useMessageLogs(options?: {
  enabled?: boolean;
  /** Archived (soft-deleted) logs — a privileged view (`messaging.clearLogs`). */
  includeDeleted?: boolean;
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
      options?.includeDeleted === true ? "archived" : "active",
    ],
    queryData: {
      query: {
        page,
        pageSize,
        ...(options?.includeDeleted === true ? { includeDeleted: true } : {}),
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
    placeholderData: keepPreviousData,
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
    logs: res.logs ?? EMPTY_LOGS,
    total: res.total ?? res.logs?.length ?? 0,
    page: res.page ?? page,
    pageSize: res.pageSize ?? pageSize,
    hasMore: Boolean(res.hasMore),
  };
}

/** Date-ranged messaging KPI metrics (auth-gated). */
export function useMessagingMetrics(options?: {
  enabled?: boolean;
  startDate?: string;
  endDate?: string;
}) {
  const { isAuthenticated } = useAuth();
  const query = tsrClient.messaging.getMetrics.useQuery({
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

  const metrics =
    query.data?.status === 200
      ? ((query.data.body as { metrics?: MessagingMetricsDto } | null)?.metrics ?? undefined)
      : undefined;

  return { ...query, data: metrics, metrics };
}

/** Template/log/record/clear/restore mutations with Query invalidation + error toasts. */
export function useMessagingMutations() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const invalidate = () => {
    invalidateMessagingQueries(queryClient);
  };

  const onError = (error: unknown) => {
    notifyApiFailure(error, t);
  };

  const saveTemplate = tsrClient.messaging.saveTemplate.useMutation({
    onSuccess: () => invalidate(),
    onError,
  });

  const deleteTemplate = tsrClient.messaging.deleteTemplate.useMutation({
    onSuccess: () => invalidate(),
    onError,
  });

  const recordDispatches = tsrClient.messaging.recordLogs.useMutation({
    onSuccess: () => invalidate(),
    onError,
  });

  const clearLogs = tsrClient.messaging.clearLogs.useMutation({
    onSuccess: () => invalidate(),
    onError,
  });

  const restoreLogs = tsrClient.messaging.restoreLogs.useMutation({
    onSuccess: () => invalidate(),
    onError,
  });

  const { dispatchServerSms, dispatchServerEmail, dispatchServerWhatsApp } =
    useMessagingDispatchMutations();

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
    restoreLogs: {
      ...restoreLogs,
      mutateAsync: (ids?: string[]) =>
        (restoreLogs.mutateAsync as (arg: { body: { ids?: string[] } }) => Promise<unknown>)({
          body: ids?.length ? { ids } : {},
        }),
    },
    dispatchServerSms,
    dispatchServerEmail,
    dispatchServerWhatsApp,
  };
}
