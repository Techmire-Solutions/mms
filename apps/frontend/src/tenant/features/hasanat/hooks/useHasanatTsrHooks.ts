/**
 * Phase 7: Contract-driven query/mutation hooks for the Hasanat module.
 */
import { apiContract, tsrClient } from "@/lib/api";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import {
  HASANAT_DISTRIBUTIONS_QUERY_KEY,
  HASANAT_DENOMS_QUERY_KEY,
  HASANAT_BATCHES_QUERY_KEY,
  HASANAT_REDEMPTIONS_QUERY_KEY,
} from "@/tenant/features/hasanat/hooks/useHasanatApi";
import { invalidateHasanatQueries } from "@/tenant/features/hasanat/hooks/invalidateHasanatQueries";

export function hasanatListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [HASANAT_DISTRIBUTIONS_QUERY_KEY, "contract-list", query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.hasanat.listDistributions({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        throw new Error("Failed to fetch hasanat distributions");
      }
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useHasanatContractList(query: Record<string, unknown> = {}, enabled = true) {
  const { can } = usePermissions();
  return tsrClient.hasanat.listDistributions.useQuery({
    queryKey: [HASANAT_DISTRIBUTIONS_QUERY_KEY, "contract-list", query],
    queryData: { query },
    staleTime: 15_000,
    enabled: can("hasanat.read") && enabled,
  });
}

export function useHasanatContractDenoms(enabled = true) {
  const { can } = usePermissions();
  return tsrClient.hasanat.listDenoms.useQuery({
    queryKey: [HASANAT_DENOMS_QUERY_KEY, "contract-list"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled: can("hasanat.read") && enabled,
  });
}

export function useHasanatContractBatches(enabled = true) {
  const { can } = usePermissions();
  return tsrClient.hasanat.listBatches.useQuery({
    queryKey: [HASANAT_BATCHES_QUERY_KEY, "contract-list"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled: can("hasanat.read") && enabled,
  });
}

export function useHasanatContractRedemptions(enabled = true) {
  const { can } = usePermissions();
  return tsrClient.hasanat.listRedemptions.useQuery({
    queryKey: [HASANAT_REDEMPTIONS_QUERY_KEY, "contract-list"],
    queryData: { query: {} },
    staleTime: 30_000,
    enabled: can("hasanat.read") && enabled,
  });
}

export function useHasanatContractBulkDelete() {
  const queryClient = useQueryClient();
  return tsrClient.hasanat.bulkDeleteDistributions.useMutation({
    onSuccess: () => invalidateHasanatQueries(queryClient),
  });
}

export function useHasanatContractBulkRestore() {
  const queryClient = useQueryClient();
  return tsrClient.hasanat.bulkRestoreDistributions.useMutation({
    onSuccess: () => invalidateHasanatQueries(queryClient),
  });
}

export function useHasanatContractDeleteDistribution() {
  const queryClient = useQueryClient();
  return tsrClient.hasanat.deleteDistribution.useMutation({
    onSuccess: () => invalidateHasanatQueries(queryClient),
  });
}

export function useHasanatContractRestoreDistribution() {
  const queryClient = useQueryClient();
  return tsrClient.hasanat.restoreDistribution.useMutation({
    onSuccess: () => invalidateHasanatQueries(queryClient),
  });
}
