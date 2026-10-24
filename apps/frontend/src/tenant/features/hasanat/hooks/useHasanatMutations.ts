import { useQueryClient } from "@tanstack/react-query";
import type { MutateOptions } from "@tanstack/react-query";
import type { Denomination, StockBatch, Distribution, Redemption } from "@mms/shared";
import { tsrClient } from "@/lib/api";
import { invalidateHasanatQueries } from "./invalidateHasanatQueries";

export function useHasanatMutations() {
  const queryClient = useQueryClient();

  const invalidateDistributions = () => {
    invalidateHasanatQueries(queryClient);
  };

  const replaceDenoms = tsrClient.hasanat.replaceDenoms.useMutation({
    onSuccess: () => invalidateHasanatQueries(queryClient),
  });

  const replaceBatches = tsrClient.hasanat.replaceBatches.useMutation({
    onSuccess: () => invalidateHasanatQueries(queryClient),
  });

  const createDistribution = tsrClient.hasanat.createDistribution.useMutation({
    onSuccess: invalidateDistributions,
  });
  const updateDistribution = tsrClient.hasanat.updateDistribution.useMutation({
    onSuccess: invalidateDistributions,
  });
  const deleteDistribution = tsrClient.hasanat.deleteDistribution.useMutation({
    onSuccess: invalidateDistributions,
  });
  const restoreDistribution = tsrClient.hasanat.restoreDistribution.useMutation({
    onSuccess: invalidateDistributions,
  });
  const bulkDeleteDistributions = tsrClient.hasanat.bulkDeleteDistributions.useMutation({
    onSuccess: invalidateDistributions,
  });
  const bulkRestoreDistributions = tsrClient.hasanat.bulkRestoreDistributions.useMutation({
    onSuccess: invalidateDistributions,
  });

  const replaceRedemptions = tsrClient.hasanat.replaceRedemptions.useMutation({
    onSuccess: () => invalidateHasanatQueries(queryClient),
  });

  return {
    replaceDenoms: {
      ...replaceDenoms,
      mutate: (denoms: Denomination[], opts?: MutateOptions) =>
        replaceDenoms.mutate({ body: denoms }, opts),
      mutateAsync: (denoms: Denomination[]) => replaceDenoms.mutateAsync({ body: denoms }),
    },
    replaceBatches: {
      ...replaceBatches,
      mutate: (batches: StockBatch[], opts?: MutateOptions) =>
        replaceBatches.mutate({ body: batches }, opts),
      mutateAsync: (batches: StockBatch[]) => replaceBatches.mutateAsync({ body: batches }),
    },
    createDistribution: {
      ...createDistribution,
      mutateAsync: (distribution: Distribution) =>
        createDistribution.mutateAsync({ body: distribution }),
    },
    updateDistribution: {
      ...updateDistribution,
      mutateAsync: (distribution: Distribution) =>
        updateDistribution.mutateAsync({
          params: { id: String(distribution.id) },
          body: distribution,
        }),
    },
    replaceRedemptions: {
      ...replaceRedemptions,
      mutate: (redemptions: Redemption[], opts?: MutateOptions) =>
        replaceRedemptions.mutate({ body: redemptions }, opts),
      mutateAsync: (redemptions: Redemption[]) =>
        replaceRedemptions.mutateAsync({ body: redemptions }),
    },
    deleteDistribution: {
      ...deleteDistribution,
      mutate: (id: string, opts?: MutateOptions) =>
        deleteDistribution.mutate({ params: { id }, body: {} }, opts),
      mutateAsync: (id: string) => deleteDistribution.mutateAsync({ params: { id }, body: {} }),
    },
    restoreDistribution: {
      ...restoreDistribution,
      mutate: (id: string, opts?: MutateOptions) =>
        restoreDistribution.mutate({ params: { id }, body: {} }, opts),
      mutateAsync: (id: string) => restoreDistribution.mutateAsync({ params: { id }, body: {} }),
    },
    bulkDeleteDistributions: {
      ...bulkDeleteDistributions,
      mutate: (ids: string[], opts?: MutateOptions) =>
        bulkDeleteDistributions.mutate({ body: { ids } }, opts),
      mutateAsync: (ids: string[]) => bulkDeleteDistributions.mutateAsync({ body: { ids } }),
    },
    bulkRestoreDistributions: {
      ...bulkRestoreDistributions,
      mutate: (ids: string[], opts?: MutateOptions) =>
        bulkRestoreDistributions.mutate({ body: { ids } }, opts),
      mutateAsync: (ids: string[]) => bulkRestoreDistributions.mutateAsync({ body: { ids } }),
    },
  };
}
