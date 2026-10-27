import { useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import type { SessionsCommandMetricsSnapshot } from "@mms/shared";
import { SESSIONS_MODULE_MANIFEST, sessionsWidgetQueryFromWidget } from "@mms/shared";
import { serverMetricsQueryOptions, useServerMetrics } from "@/hooks/useServerMetrics";
import { useAuth } from "@/lib/contexts/AuthContext";
import { tsrClient, apiContract } from "@/lib/api";
import type { Session } from "@/lib/data/sessionsData";
import { invalidateSessionsQueries } from "@/tenant/features/sessions/hooks/invalidateSessionsQueries";

export function sessionsCommandMetricsQueryOptions() {
  return serverMetricsQueryOptions<SessionsCommandMetricsSnapshot>({
    moduleId: SESSIONS_MODULE_MANIFEST.moduleId,
    apiPath: SESSIONS_MODULE_MANIFEST.restBasePath,
  });
}

import {
  SESSIONS_METRICS_QUERY_KEY,
  SESSIONS_QUERY_KEY,
  SESSIONS_REPORT_AGGREGATES_QUERY_KEY,
  SESSIONS_WIDGET_AGGREGATES_QUERY_KEY,
} from "./sessionsQueryKeys.js";

export {
  SESSIONS_METRICS_QUERY_KEY,
  SESSIONS_QUERY_KEY,
  SESSIONS_REPORT_AGGREGATES_QUERY_KEY,
  SESSIONS_WIDGET_AGGREGATES_QUERY_KEY,
};

export interface SessionsPaginatedParams {
  page: number;
  limit?: number;
  search?: string;
  status?: string;
  type?: string;
  sortField?: string;
  sortDir?: "asc" | "desc";
  includeDeleted?: boolean;
  enabled?: boolean;
}

export interface SessionsWidgetAggregateWidgetInput {
  id: string;
  collection: string;
  operation: "count" | "sum" | "avg" | "percentage";
  targetField?: string;
  filterField?: string;
  filterOperator?: "equals" | "contains" | "gt" | "lt";
  filterValue?: string;
  xAxisField?: string;
}

export function useSessionsPaginated(params: SessionsPaginatedParams) {
  const { isAuthenticated } = useAuth();
  const enabled = params.enabled ?? true;
  return tsrClient.sessions.list.useQuery({
    queryKey: [...SESSIONS_QUERY_KEY, "page", params],
    queryData: {
      query: {
        page: params.page,
        limit: params.limit ?? SESSIONS_MODULE_MANIFEST.defaultPageSize,
        search: params.search?.trim(),
        status: params.status?.trim(),
        type: params.type?.trim(),
        sortField: params.sortField?.trim(),
        sortDir: params.sortDir,
        includeDeleted: params.includeDeleted ? "true" : undefined,
      },
    },
    enabled: isAuthenticated && enabled,
    staleTime: 15_000,
    placeholderData: (previousData: unknown) => previousData,
  });
}

export function useSessions(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  return tsrClient.sessions.list.useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryData: { query: { page: 1, limit: 100, sortField: "createdAt", sortDir: "desc" } },
    enabled: isAuthenticated && enabled,
    staleTime: 15_000,
  });
}
export { useSessionMutations } from "./useSessionMutations";

/**
 * Full session (classes with fees, timetables, …) for detail/edit surfaces.
 * List rows are summary-shaped; saving them would replace class children with empty arrays.
 */
export function useSessionDetail(summary: Session | null): Session | null {
  const { isAuthenticated } = useAuth();
  const id = summary ? String(summary.id) : "";
  const includeDeleted = summary?.deletedAt ? "true" : undefined;
  const query = tsrClient.sessions.get.useQuery({
    queryKey: [...SESSIONS_QUERY_KEY, "detail", id, includeDeleted ?? "active"],
    queryData: { params: { id }, query: includeDeleted ? { includeDeleted } : {} },
    enabled: isAuthenticated && Boolean(id),
    staleTime: 15_000,
  });
  if (!id || !query.data || query.data.status !== 200) return null;
  const session = (query.data.body as { session?: Session } | null)?.session;
  return session && String(session.id) === id ? session : null;
}

export function useSessionsCollection(options?: { enabled?: boolean }): Session[] {
  const query = useSessions(options);
  if (!query.data || query.data.status !== 200) return [];
  const body = query.data.body;
  if (Array.isArray(body)) return body as Session[];
  if (body && typeof body === "object" && "sessions" in body && Array.isArray(body.sessions)) {
    return body.sessions as Session[];
  }
  return [];
}

export function useSessionsWidgetAggregates(
  widgets: SessionsWidgetAggregateWidgetInput[],
  options?: { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  const sessionQueries = widgets
    .filter((widget) => widget.collection === "sessions")
    .map((widget) => sessionsWidgetQueryFromWidget(widget));
  const querySignature = sessionQueries
    .map((query) => query.id)
    .sort()
    .join(",");

  const query = useQuery({
    queryKey: [...SESSIONS_WIDGET_AGGREGATES_QUERY_KEY, querySignature] as const,
    queryFn: async () => {
      const res = await apiContract.sessions.widgetAggregates({
        body: { widgets: sessionQueries },
      });
      return (
        (
          res.body as {
            results?: Record<
              string,
              {
                value?: number;
                totalCount?: number;
                chartData?: Array<{ name: string; value: number }>;
              }
            >;
          } | null
        )?.results ?? {}
      );
    },
    enabled: isAuthenticated && enabled && sessionQueries.length > 0,
    staleTime: 30_000,
  });

  return { ...query, data: query.data ?? {} };
}

export function useSessionsMetrics(options?: { enabled?: boolean }) {
  return useServerMetrics<SessionsCommandMetricsSnapshot>({
    moduleId: SESSIONS_MODULE_MANIFEST.moduleId,
    apiPath: SESSIONS_MODULE_MANIFEST.restBasePath,
    enabled: options?.enabled,
  });
}

export function useSessionsReportAggregates(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  return tsrClient.sessions.reportAggregates.useQuery({
    queryKey: SESSIONS_REPORT_AGGREGATES_QUERY_KEY,
    enabled: isAuthenticated && enabled,
    staleTime: 30_000,
  });
}

// --- Contract-driven list queryOptions & mutation hooks ----------------------

export function sessionsListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [...SESSIONS_QUERY_KEY, query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.sessions.list({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        throw new Error("Failed to fetch sessions");
      }
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useSessionsContractList(query: Record<string, unknown>, enabled = true) {
  return tsrClient.sessions.list.useQuery({
    queryKey: [...SESSIONS_QUERY_KEY, query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useSessionsContractCreate() {
  const queryClient = useQueryClient();
  return tsrClient.sessions.create.useMutation({
    onSuccess: () => invalidateSessionsQueries(queryClient),
  });
}

export function useSessionsContractBulkDelete() {
  const queryClient = useQueryClient();
  return tsrClient.sessions.bulkDelete.useMutation({
    onSuccess: () => invalidateSessionsQueries(queryClient),
  });
}

export function useSessionsContractBulkStatus() {
  const queryClient = useQueryClient();
  return tsrClient.sessions.bulkStatus.useMutation({
    onSuccess: () => invalidateSessionsQueries(queryClient),
  });
}

export function useSessionsContractBulkRestore() {
  const queryClient = useQueryClient();
  return tsrClient.sessions.bulkRestore.useMutation({
    onSuccess: () => invalidateSessionsQueries(queryClient),
  });
}
