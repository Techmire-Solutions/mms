import { useQuery, queryOptions } from "@tanstack/react-query";
import type { SessionsCommandMetricsSnapshot, SessionsReportAggregates } from "@mms/shared";
import { SESSIONS_MODULE_MANIFEST, sessionsWidgetQueryFromWidget } from "@mms/shared";
import { serverMetricsQueryOptions, useServerMetrics } from "@/hooks/useServerMetrics";
import { useAuth } from "@/lib/contexts/AuthContext";
import { tsrClient, apiContract } from "@/lib/api";
import { assertContractOk } from "@/lib/apiContractError";
import { fetchWidgetAggregatesBatched } from "@/lib/reports/widgetAggregatesBatch";
import type { Session } from "@/lib/data/sessionsData";

export function sessionsCommandMetricsQueryOptions() {
  return serverMetricsQueryOptions<SessionsCommandMetricsSnapshot>({
    moduleId: SESSIONS_MODULE_MANIFEST.moduleId,
    apiPath: SESSIONS_MODULE_MANIFEST.restBasePath,
  });
}

import {
  SESSION_DETAIL_QUERY_KEY,
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
        // Work rows only need metadata + class counts; details fetch the full record.
        view: "summary",
      },
    },
    enabled: isAuthenticated && enabled,
    staleTime: 15_000,
  });
}

export function useSessions(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  return tsrClient.sessions.list.useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryData: {
      query: { page: 1, limit: 100, sortField: "createdAt", sortDir: "desc", view: "summary" },
    },
    enabled: isAuthenticated && enabled,
    staleTime: 15_000,
  });
}
export { useSessionMutations } from "./useSessionMutations";

/**
 * Full session (classes with fees, timetables, …) for detail/edit surfaces.
 * List rows are summary-shaped; saving them would replace class children with empty arrays.
 */
export interface SessionDetailState {
  session: Session | null;
  /** True while a summary has been selected but the full record is still loading. */
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

function useSessionDetailResolver(summary: Session | null): SessionDetailState {
  const { isAuthenticated } = useAuth();
  const id = summary ? String(summary.id) : "";
  const includeDeleted = Boolean(summary?.deletedAt);
  const query = useQuery({
    ...sessionDetailQueryOptions(id, includeDeleted),
    enabled: isAuthenticated && Boolean(id),
  });
  const resolved = query.data && String(query.data.id) === id ? query.data : null;
  return {
    session: resolved,
    isLoading: Boolean(id) && query.isLoading,
    // A settled non-200 (404/403) must surface as an error, not an endless skeleton.
    isError: Boolean(id) && (query.isError || (query.isFetched && !resolved)),
    refetch: () => {
      void query.refetch();
    },
  };
}

/** Full session (classes with fees, timetables, …) for detail/edit surfaces. */
export function useSessionDetail(summary: Session | null): Session | null {
  return useSessionDetailResolver(summary).session;
}

/** Detail/addressing state including loading/error so overlays can show feedback. */
export function useSessionDetailState(summary: Session | null): SessionDetailState {
  return useSessionDetailResolver(summary);
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
    queryFn: async () =>
      fetchWidgetAggregatesBatched(sessionQueries, (batch) =>
        apiContract.sessions.widgetAggregates({ body: { widgets: batch } }),
      ),
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
  return useQuery({
    ...sessionReportAggregatesQueryOptions(),
    enabled: isAuthenticated && enabled,
  });
}

/** Shared contract-driven list factory (facade invariant: one `*ListQueryOptions` per module). */
export function sessionsListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [...SESSIONS_QUERY_KEY, query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.sessions.list({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to fetch sessions");
      return response.body;
    },
    staleTime: 15_000,
  });
}

/** Full-session detail query factory (summary rows are lazy-resolved to their full record). */
export function sessionDetailQueryOptions(id: string, includeDeleted: boolean) {
  return queryOptions({
    queryKey: [...SESSION_DETAIL_QUERY_KEY, id, includeDeleted ? "deleted" : "active"] as const,
    queryFn: async ({ signal }): Promise<Session | null> => {
      const response = await apiContract.sessions.get({
        params: { id },
        query: includeDeleted ? { includeDeleted: "true" } : {},
        signal,
      });
      assertContractOk(response, "Failed to load session");
      return (response.body as { session?: Session } | null)?.session ?? null;
    },
    staleTime: 15_000,
  });
}

/** Report-aggregates query factory. */
export function sessionReportAggregatesQueryOptions() {
  return queryOptions({
    queryKey: SESSIONS_REPORT_AGGREGATES_QUERY_KEY,
    queryFn: async ({ signal }): Promise<SessionsReportAggregates> => {
      const response = await apiContract.sessions.reportAggregates({ signal });
      assertContractOk(response, "Failed to load session report aggregates");
      return response.body as SessionsReportAggregates;
    },
    staleTime: 30_000,
  });
}
