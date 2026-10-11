/**
 * Phase 7: Contract-driven query/mutation hooks for the Attendance module.
 */
import { apiContract, tsrClient } from "@/lib/api";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { ATTENDANCE_QUERY_KEY } from "@/tenant/features/attendance/hooks/useAttendance";
import { invalidateAttendanceQueries } from "@/tenant/features/attendance/hooks/invalidateAttendanceQueries";

export function attendanceListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [...ATTENDANCE_QUERY_KEY, "contract", query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.attendance.list({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        throw new Error("Failed to fetch attendance");
      }
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useAttendanceContractList(query: Record<string, unknown>, enabled = true) {
  return tsrClient.attendance.list.useQuery({
    queryKey: [...ATTENDANCE_QUERY_KEY, "contract", query],
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
