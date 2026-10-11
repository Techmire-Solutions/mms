import { useQuery } from "@tanstack/react-query";
import type {
  Enrollment,
  EnrollmentsCommandMetricsSnapshot,
  EnrollmentsReportComparisonQuery,
  EnrollmentsWidgetAggregateResult,
  EnrollmentsWidgetOperation,
  EnrollmentsWidgetFilterOperator,
} from "@mms/shared";
import {
  ENROLLMENTS_MODULE_MANIFEST,
  enrollmentsWidgetQueryFromWidget,
  normalizeEnrollmentsReportComparisonQuery,
} from "@mms/shared";
import { serverMetricsQueryOptions, useServerMetrics } from "@/hooks/useServerMetrics";
import { useAuth } from "@/lib/contexts/AuthContext";
import { tsrClient, apiContract } from "@/lib/api";

export const ENROLLMENTS_QUERY_KEY = ["enrollments", "list"] as const;
export const ENROLLMENTS_METRICS_QUERY_KEY = ["enrollments", "metrics"] as const;
export const ENROLLMENTS_REPORT_AGGREGATES_QUERY_KEY = [
  ENROLLMENTS_MODULE_MANIFEST.collectionKey,
  "report-aggregates",
] as const;
export const ENROLLMENTS_WIDGET_AGGREGATES_QUERY_KEY = [
  ENROLLMENTS_MODULE_MANIFEST.collectionKey,
  "widget-aggregates",
] as const;

export interface EnrollmentsWidgetAggregateWidgetInput {
  id: string;
  collection: string;
  operation: EnrollmentsWidgetOperation;
  targetField?: string;
  filterField?: string;
  filterOperator?: EnrollmentsWidgetFilterOperator;
  filterValue?: string;
  xAxisField?: string;
}

export interface EnrollmentsPaginatedParams {
  page: number;
  limit?: number;
  search?: string;
  status?: string;
  sessionId?: string;
  classId?: string;
  includeDeleted?: boolean;
  enabled?: boolean;
}

export interface EnrollmentsCollectionOptions {
  enabled?: boolean;
  sessionId?: string;
  classId?: string;
}

const ENROLLMENTS_API = ENROLLMENTS_MODULE_MANIFEST.restBasePath;

function buildEnrollmentsPageUrl(params: EnrollmentsPaginatedParams): string {
  const queryParams = new URLSearchParams();
  queryParams.set("page", String(params.page));
  queryParams.set("limit", String(params.limit ?? ENROLLMENTS_MODULE_MANIFEST.defaultPageSize));
  if (params.search?.trim()) queryParams.set("search", params.search.trim());
  if (params.status?.trim() && params.status !== "all")
    queryParams.set("status", params.status.trim());
  if (params.sessionId?.trim() && params.sessionId !== "all")
    queryParams.set("sessionId", params.sessionId.trim());
  if (params.classId?.trim() && params.classId !== "all")
    queryParams.set("classId", params.classId.trim());
  if (params.includeDeleted) queryParams.set("includeDeleted", "true");
  return `${ENROLLMENTS_API}?${queryParams.toString()}`;
}

export function enrollmentsCommandMetricsQueryOptions() {
  return serverMetricsQueryOptions<EnrollmentsCommandMetricsSnapshot>({
    moduleId: ENROLLMENTS_MODULE_MANIFEST.moduleId,
    apiPath: ENROLLMENTS_MODULE_MANIFEST.restBasePath,
  });
}

export function useEnrollmentsPaginated(params: EnrollmentsPaginatedParams) {
  const { isAuthenticated } = useAuth();
  const enabled = params.enabled ?? true;
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.enrollments.list.useQuery({
    queryKey: [...ENROLLMENTS_QUERY_KEY, "page", params],
    queryData: {
      query: {
        page: params.page,
        limit: params.limit ?? ENROLLMENTS_MODULE_MANIFEST.defaultPageSize,
        search: params.search?.trim(),
        status: params.status?.trim() && params.status !== "all" ? params.status.trim() : undefined,
        sessionId:
          params.sessionId?.trim() && params.sessionId !== "all"
            ? params.sessionId.trim()
            : undefined,
        classId:
          params.classId?.trim() && params.classId !== "all" ? params.classId.trim() : undefined,
        includeDeleted: params.includeDeleted ? "true" : undefined,
      },
    },
    enabled: isAuthenticated && enabled,
    staleTime: 15_000,
    placeholderData: (previousData: unknown) => previousData,
  });
}

export function useEnrollments(options?: EnrollmentsCollectionOptions) {
  const { isAuthenticated } = useAuth();
  const sessionId = options?.sessionId?.trim() || undefined;
  const classId = options?.classId?.trim() || undefined;
  const scopedQueryKey =
    sessionId || classId
      ? ([...ENROLLMENTS_QUERY_KEY, "scope", { sessionId, classId }] as const)
      : ENROLLMENTS_QUERY_KEY;
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.enrollments.list.useQuery({
    queryKey: scopedQueryKey,
    queryData: {
      query: { page: 1, limit: ENROLLMENTS_MODULE_MANIFEST.maxPageSize, sessionId, classId },
    },
    enabled: isAuthenticated && (options?.enabled ?? true),
    staleTime: 15_000,
  });
}

export function useEnrollmentsCollection(options?: EnrollmentsCollectionOptions): Enrollment[] {
  const query = useEnrollments(options);
  if (!query.data || query.data.status !== 200) return [];
  const body: unknown = query.data.body;
  return Array.isArray(body)
    ? (body as Enrollment[])
    : ((body as { enrollments?: Enrollment[] } | null)?.enrollments ?? []);
}

export function useEnrollmentsMetrics(options?: { enabled?: boolean }) {
  return useServerMetrics<EnrollmentsCommandMetricsSnapshot>({
    moduleId: ENROLLMENTS_MODULE_MANIFEST.moduleId,
    apiPath: ENROLLMENTS_MODULE_MANIFEST.restBasePath,
    enabled: options?.enabled,
  });
}

export function useEnrollmentsReportAggregates(options?: {
  enabled?: boolean;
  comparison?: EnrollmentsReportComparisonQuery;
}) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  const comparison = normalizeEnrollmentsReportComparisonQuery(options?.comparison);
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.enrollments.reportAggregates.useQuery({
    queryKey: [...ENROLLMENTS_REPORT_AGGREGATES_QUERY_KEY, comparison ?? null],
    queryData: {
      query: {
        sessionIds: comparison?.sessionIds?.length ? comparison.sessionIds.join(",") : undefined,
        rangeAFrom: comparison?.rangeAFrom,
        rangeATo: comparison?.rangeATo,
        rangeBFrom: comparison?.rangeBFrom,
        rangeBTo: comparison?.rangeBTo,
      },
    },
    enabled: isAuthenticated && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEnrollmentsWidgetAggregates(
  widgets: EnrollmentsWidgetAggregateWidgetInput[],
  options?: { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  const enrollmentQueries = widgets
    .filter((widget) => widget.collection === "enrollments")
    .map((widget) => enrollmentsWidgetQueryFromWidget(widget));
  const querySignature = enrollmentQueries
    .map((q) => q.id)
    .sort()
    .join(",");

  const query = useQuery({
    queryKey: [...ENROLLMENTS_WIDGET_AGGREGATES_QUERY_KEY, querySignature] as const,
    queryFn: async () => {
      const res = await apiContract.enrollments.widgetAggregates({
        body: { widgets: enrollmentQueries },
      });
      const body = res.body as {
        results?: Record<string, EnrollmentsWidgetAggregateResult>;
      } | null;
      return body?.results ?? {};
    },
    enabled: isAuthenticated && enabled && enrollmentQueries.length > 0,
    staleTime: 30_000,
  });

  return { ...query, data: query.data ?? {} };
}

// keep URL builder available for consumers who need raw URLs
export { buildEnrollmentsPageUrl };
