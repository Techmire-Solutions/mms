/**
 * Obligations contract-driven server-state surface: list query options, contract
 * query hooks, and contract mutations.
 */
import { apiContract, tsrClient } from "@/lib/api";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { invalidateObligationsQueries } from "@/tenant/features/obligations/hooks/invalidateObligationsQueries";
import {
  OBLIGATIONS_TYPES_QUERY_KEY,
  OBLIGATIONS_MUJTAHIDS_QUERY_KEY,
  OBLIGATIONS_REPS_QUERY_KEY,
  OBLIGATIONS_WAKALA_QUERY_KEY,
  OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY,
  OBLIGATIONS_COLLECTIONS_QUERY_KEY,
} from "@/tenant/features/obligations/hooks/obligationsQueryKeys";

export function obligationsCollectionsListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [...OBLIGATIONS_COLLECTIONS_QUERY_KEY, "contract", query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.obligations.listCollections({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        throw new Error("Failed to fetch obligations collections");
      }
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useObligationsContractCollections(query: Record<string, unknown>, enabled = true) {
  return tsrClient.obligations.listCollections.useQuery({
    queryKey: [...OBLIGATIONS_COLLECTIONS_QUERY_KEY, "contract", query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useObligationsContractTypes(enabled = true) {
  return tsrClient.obligations.listTypes.useQuery({
    queryKey: [...OBLIGATIONS_TYPES_QUERY_KEY, "contract"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled,
  });
}

export function useObligationsContractMujtahids(enabled = true) {
  return tsrClient.obligations.listMujtahids.useQuery({
    queryKey: [...OBLIGATIONS_MUJTAHIDS_QUERY_KEY, "contract"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled,
  });
}

export function useObligationsContractDistributions(enabled = true) {
  return tsrClient.obligations.listDistributions.useQuery({
    queryKey: [...OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY, "contract"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled,
  });
}

export function useObligationsContractReps(enabled = true) {
  return tsrClient.obligations.listReps.useQuery({
    queryKey: [...OBLIGATIONS_REPS_QUERY_KEY, "contract"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled,
  });
}

export function useObligationsContractWakala(enabled = true) {
  return tsrClient.obligations.listWakala.useQuery({
    queryKey: [...OBLIGATIONS_WAKALA_QUERY_KEY, "contract"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled,
  });
}

export function useObligationsContractDeleteCollection() {
  const queryClient = useQueryClient();
  return tsrClient.obligations.deleteCollection.useMutation({
    onSuccess: () => invalidateObligationsQueries(queryClient),
  });
}

export function useObligationsContractRestoreCollection() {
  const queryClient = useQueryClient();
  return tsrClient.obligations.restoreCollection.useMutation({
    onSuccess: () => invalidateObligationsQueries(queryClient),
  });
}

export function useObligationsContractBulkDeleteCollections() {
  const queryClient = useQueryClient();
  return tsrClient.obligations.bulkDeleteCollections.useMutation({
    onSuccess: () => invalidateObligationsQueries(queryClient),
  });
}

export function useObligationsContractBulkRestoreCollections() {
  const queryClient = useQueryClient();
  return tsrClient.obligations.bulkRestoreCollections.useMutation({
    onSuccess: () => invalidateObligationsQueries(queryClient),
  });
}
