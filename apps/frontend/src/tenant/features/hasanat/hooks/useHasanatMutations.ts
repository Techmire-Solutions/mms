import { useQueryClient } from "@tanstack/react-query";
import type { MutateOptions } from "@tanstack/react-query";
import type { Denomination, StockBatch, Distribution, Redemption } from "@mms/shared";
import { tsrClient } from "@/lib/api";
import {
  HASANAT_DENOMS_QUERY_KEY,
  HASANAT_BATCHES_QUERY_KEY,
  HASANAT_DISTRIBUTIONS_QUERY_KEY,
  HASANAT_REDEMPTIONS_QUERY_KEY,
  HASANAT_METRICS_QUERY_KEY,
} from "./useHasanatQueries";

export function useHasanatMutations() {
  const queryClient = useQueryClient();

  const invalidateDistributions = () => {
    void queryClient.invalidateQueries({ queryKey: HASANAT_DISTRIBUTIONS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: HASANAT_METRICS_QUERY_KEY });
  };

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const replaceDenoms = tsrClient.hasanat.replaceDenoms.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: HASANAT_DENOMS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: HASANAT_METRICS_QUERY_KEY });
    },
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const replaceBatches = tsrClient.hasanat.replaceBatches.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: HASANAT_BATCHES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: HASANAT_METRICS_QUERY_KEY });
    },
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const createDistribution = tsrClient.hasanat.createDistribution.useMutation({
    onSuccess: invalidateDistributions,
  });
  // @ts-expect-error - TS union discrimination limit with ts-rest
  const updateDistribution = tsrClient.hasanat.updateDistribution.useMutation({
    onSuccess: invalidateDistributions,
  });
  // @ts-expect-error - TS union discrimination limit with ts-rest
  const deleteDistribution = tsrClient.hasanat.deleteDistribution.useMutation({
    onSuccess: invalidateDistributions,
  });
  // @ts-expect-error - TS union discrimination limit with ts-rest
  const restoreDistribution = tsrClient.hasanat.restoreDistribution.useMutation({
    onSuccess: invalidateDistributions,
  });
  // @ts-expect-error - TS union discrimination limit with ts-rest
  const bulkDeleteDistributions = tsrClient.hasanat.bulkDeleteDistributions.useMutation({
    onSuccess: invalidateDistributions,
  });
  // @ts-expect-error - TS union discrimination limit with ts-rest
  const bulkRestoreDistributions = tsrClient.hasanat.bulkRestoreDistributions.useMutation({
    onSuccess: invalidateDistributions,
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const replaceRedemptions = tsrClient.hasanat.replaceRedemptions.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: HASANAT_REDEMPTIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: HASANAT_METRICS_QUERY_KEY });
    },
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
