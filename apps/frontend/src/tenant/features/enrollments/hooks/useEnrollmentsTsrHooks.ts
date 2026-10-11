/**
 * Phase 7: Contract-driven query/mutation hooks for the Enrollments module.
 */
import { apiContract, tsrClient } from "@/lib/api";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { ENROLLMENTS_QUERY_KEY } from "@/tenant/features/enrollments/hooks/useEnrollmentsApi";
import { invalidateEnrollmentsQueries } from "@/tenant/features/enrollments/hooks/invalidateEnrollmentsQueries";

export function enrollmentsListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [...ENROLLMENTS_QUERY_KEY, "contract", query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.enrollments.list({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        throw new Error("Failed to fetch enrollments");
      }
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useEnrollmentsContractList(query: Record<string, unknown>, enabled = true) {
  return tsrClient.enrollments.list.useQuery({
    queryKey: [...ENROLLMENTS_QUERY_KEY, "contract", query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useEnrollmentsContractGet(id: string, enabled = true) {
  return tsrClient.enrollments.get.useQuery({
    queryKey: [...ENROLLMENTS_QUERY_KEY, "detail", id],
    queryData: { params: { id } },
    enabled,
    staleTime: 30_000,
  });
}

export function useEnrollmentsContractCreate() {
  const queryClient = useQueryClient();
  return tsrClient.enrollments.create.useMutation({
    onSuccess: () => invalidateEnrollmentsQueries(queryClient),
  });
}

export function useEnrollmentsContractUpdate() {
  const queryClient = useQueryClient();
  return tsrClient.enrollments.update.useMutation({
    onSuccess: () => invalidateEnrollmentsQueries(queryClient),
  });
}

export function useEnrollmentsContractDelete() {
  const queryClient = useQueryClient();
  return tsrClient.enrollments.delete.useMutation({
    onSuccess: () => invalidateEnrollmentsQueries(queryClient),
  });
}

export function useEnrollmentsContractBulkDelete() {
  const queryClient = useQueryClient();
  return tsrClient.enrollments.bulkDelete.useMutation({
    onSuccess: () => invalidateEnrollmentsQueries(queryClient),
  });
}

export function useEnrollmentsContractBulkRestore() {
  const queryClient = useQueryClient();
  return tsrClient.enrollments.bulkRestore.useMutation({
    onSuccess: () => invalidateEnrollmentsQueries(queryClient),
  });
}
