import { useQueryClient, queryOptions } from "@tanstack/react-query";
import type { AttendanceCommandMetricsSnapshot, AttendanceListPageResult } from "@mms/shared";
import { ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import { serverMetricsQueryOptions, useServerMetrics } from "@/hooks/useServerMetrics";
import { apiContract, tsrClient } from "@/lib/api";
import { useAuth } from "@/lib/contexts/AuthContext";
import type { AttendanceRecord } from "@/lib/data/attendanceData";
import { invalidateAttendanceQueries } from "@/tenant/features/attendance/hooks/invalidateAttendanceQueries";

import {
  ATTENDANCE_METRICS_QUERY_KEY,
  ATTENDANCE_QUERY_KEY,
  ATTENDANCE_REPORT_AGGREGATES_QUERY_KEY,
} from "./attendanceQueryKeys.js";
import { assertContractOk } from "@/lib/apiContractError";

export {
  ATTENDANCE_METRICS_QUERY_KEY,
  ATTENDANCE_QUERY_KEY,
  ATTENDANCE_REPORT_AGGREGATES_QUERY_KEY,
};

export function attendanceCommandMetricsQueryOptions(selectedDate: string) {
  return serverMetricsQueryOptions<AttendanceCommandMetricsSnapshot>({
    moduleId: ATTENDANCE_MODULE_MANIFEST.moduleId,
    apiPath: ATTENDANCE_MODULE_MANIFEST.restBasePath,
    extraParam: selectedDate,
  });
}

export function useAttendanceMetrics(selectedDate: string, options?: { enabled?: boolean }) {
  return useServerMetrics<AttendanceCommandMetricsSnapshot>({
    moduleId: ATTENDANCE_MODULE_MANIFEST.moduleId,
    apiPath: ATTENDANCE_MODULE_MANIFEST.restBasePath,
    extraParam: selectedDate,
    enabled: options?.enabled,
  });
}

export interface AttendancePaginatedParams {
  page: number;
  limit?: number;
  search?: string;
  sessionId?: string;
  classId?: string;
  facultyId?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  sortField?: string;
  sortDir?: "asc" | "desc";
  includeDeleted?: boolean;
  enabled?: boolean;
}

export function useAttendancePaginated(params: AttendancePaginatedParams) {
  const { isAuthenticated } = useAuth();

  const query = tsrClient.attendance.list.useQuery({
    queryKey: [...ATTENDANCE_QUERY_KEY, "page", params] as const,
    queryData: {
      query: {
        page: params.page,
        limit: params.limit ?? ATTENDANCE_MODULE_MANIFEST.defaultPageSize,
        search: params.search?.trim(),
        sessionId: params.sessionId?.trim(),
        classId: params.classId?.trim(),
        facultyId: params.facultyId?.trim(),
        date: params.date?.trim(),
        dateFrom: params.dateFrom?.trim(),
        dateTo: params.dateTo?.trim(),
        status: params.status?.trim(),
        sortField: params.sortField?.trim(),
        sortDir: params.sortDir,
        includeDeleted: params.includeDeleted ? "true" : undefined,
      },
    },
    enabled: isAuthenticated && (params.enabled ?? true),
    staleTime: 15_000,
    placeholderData: (previousData: unknown) => previousData,
  });

  return { ...query, data: query.data?.body as AttendanceListPageResult | undefined };
}

export function useAttendanceRecords(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const query = tsrClient.attendance.list.useQuery({
    queryKey: ATTENDANCE_QUERY_KEY,
    queryData: {
      query: { page: 1, limit: ATTENDANCE_MODULE_MANIFEST.maxPageSize },
    },
    enabled: isAuthenticated && (options?.enabled ?? true),
    staleTime: 15_000,
  });

  const records = (query.data?.body as { records?: AttendanceRecord[] } | null)?.records ?? [];
  return { ...query, data: records };
}

export function useAttendanceRecordsCollection(options?: {
  enabled?: boolean;
}): AttendanceRecord[] {
  return useAttendanceRecords(options).data ?? [];
}

export function useAttendanceMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    invalidateAttendanceQueries(queryClient);
  };

  /** Bulk upsert. The legacy name is retained for callers while the endpoint remains PUT /bulk. */
  const bulkUpsert = tsrClient.attendance.bulk.useMutation({
    onSuccess: invalidate,
  });

  const createRecord = tsrClient.attendance.create.useMutation({
    onSuccess: invalidate,
  });

  const updateRecord = tsrClient.attendance.update.useMutation({
    onSuccess: invalidate,
  });

  const deleteRecord = tsrClient.attendance.delete.useMutation({
    onSuccess: invalidate,
  });

  const restoreRecord = tsrClient.attendance.restore.useMutation({
    onSuccess: invalidate,
  });

  const bulkDeleteRecords = tsrClient.attendance.bulkDelete.useMutation({
    onSuccess: invalidate,
  });

  const bulkRestoreRecords = tsrClient.attendance.bulkRestore.useMutation({
    onSuccess: invalidate,
  });

  return {
    bulkUpsert,
    replaceAll: bulkUpsert,
    createRecord,
    updateRecord,
    deleteRecord,
    restoreRecord,
    bulkDeleteRecords,
    bulkRestoreRecords,
  };
}

export { useAttendanceReportAggregates } from "./useAttendanceReportAggregates";

// --- Contract-driven list queryOptions & mutation hooks ----------------------

export function attendanceListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [...ATTENDANCE_QUERY_KEY, query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.attendance.list({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to fetch attendance");
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useAttendanceContractList(query: Record<string, unknown>, enabled = true) {
  return tsrClient.attendance.list.useQuery({
    queryKey: [...ATTENDANCE_QUERY_KEY, query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useAttendanceContractCreate() {
  const queryClient = useQueryClient();
  return tsrClient.attendance.create.useMutation({
    onSuccess: () => invalidateAttendanceQueries(queryClient),
  });
}

export function useAttendanceContractBulk() {
  const queryClient = useQueryClient();
  return tsrClient.attendance.bulk.useMutation({
    onSuccess: () => invalidateAttendanceQueries(queryClient),
  });
}

export function useAttendanceContractBulkDelete() {
  const queryClient = useQueryClient();
  return tsrClient.attendance.bulkDelete.useMutation({
    onSuccess: () => invalidateAttendanceQueries(queryClient),
  });
}

export function useAttendanceContractBulkRestore() {
  const queryClient = useQueryClient();
  return tsrClient.attendance.bulkRestore.useMutation({
    onSuccess: () => invalidateAttendanceQueries(queryClient),
  });
}

export function useAttendanceContractUpdate() {
  const queryClient = useQueryClient();
  return tsrClient.attendance.update.useMutation({
    onSuccess: () => invalidateAttendanceQueries(queryClient),
  });
}

export function useAttendanceContractDelete() {
  const queryClient = useQueryClient();
  return tsrClient.attendance.delete.useMutation({
    onSuccess: () => invalidateAttendanceQueries(queryClient),
  });
}
