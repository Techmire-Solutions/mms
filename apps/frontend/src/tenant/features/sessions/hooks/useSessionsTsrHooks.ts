/**
 * Phase 7: Contract-driven query/mutation hooks for the Sessions module.
 */
import { apiContract, tsrClient } from "@/lib/api";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { SESSIONS_QUERY_KEY } from "@/tenant/features/sessions/hooks/useSessions";
import { invalidateSessionsQueries } from "@/tenant/features/sessions/hooks/invalidateSessionsQueries";

export function sessionsListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [...SESSIONS_QUERY_KEY, "contract", query] as const,
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
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.sessions.list.useQuery({
    queryKey: [...SESSIONS_QUERY_KEY, "contract", query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useSessionsContractCreate() {
  const queryClient = useQueryClient();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.sessions.create.useMutation({
    onSuccess: () => invalidateSessionsQueries(queryClient),
  });
}

export function useSessionsContractBulkDelete() {
  const queryClient = useQueryClient();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.sessions.bulkDelete.useMutation({
    onSuccess: () => invalidateSessionsQueries(queryClient),
  });
}

export function useSessionsContractBulkStatus() {
  const queryClient = useQueryClient();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.sessions.bulkStatus.useMutation({
    onSuccess: () => invalidateSessionsQueries(queryClient),
  });
}

export function useSessionsContractBulkRestore() {
  const queryClient = useQueryClient();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.sessions.bulkRestore.useMutation({
    onSuccess: () => invalidateSessionsQueries(queryClient),
  });
}
