import { useQueryClient } from "@tanstack/react-query";
import type { MutateOptions } from "@tanstack/react-query";
import type { DistributionWrite } from "@/lib/data/hasanatData";
import type {
  Denomination,
  StockBatch,
  Distribution,
  DistributionStatusChange,
  RedeemCardBody,
  ReverseRedemptionBody,
} from "@mms/shared";
import { tsrClient } from "@/lib/api";
import {
  invalidateHasanatSetupQueries,
  invalidateHasanatWorkQueries,
} from "./invalidateHasanatQueries";
import { toCreateBody, toUpdateBody } from "../lib/hasanatMutationBodies";

export function useHasanatMutations() {
  const queryClient = useQueryClient();

  const invalidateDistributions = () => {
    invalidateHasanatWorkQueries(queryClient);
  };

  const replaceDenoms = tsrClient.hasanat.replaceDenoms.useMutation({
    onSuccess: () => invalidateHasanatSetupQueries(queryClient),
  });

  const replaceBatches = tsrClient.hasanat.replaceBatches.useMutation({
    onSuccess: () => invalidateHasanatSetupQueries(queryClient),
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

  const changeDistributionStatus = tsrClient.hasanat.changeDistributionStatus.useMutation({
    onSuccess: () => invalidateHasanatWorkQueries(queryClient),
  });
  const reverseRedemption = tsrClient.hasanat.reverseRedemption.useMutation({
    onSuccess: () => invalidateHasanatWorkQueries(queryClient),
  });

  // Atomic burn: the server locks the card and writes the ledger row + status together.
  const redeemCard = tsrClient.hasanat.redeemDistribution.useMutation({
    onSuccess: () => invalidateHasanatWorkQueries(queryClient),
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
      mutate: (distribution: DistributionWrite, opts?: MutateOptions) =>
        createDistribution.mutate({ body: toCreateBody(distribution) }, opts),
      mutateAsync: (distribution: DistributionWrite) =>
        createDistribution.mutateAsync({ body: toCreateBody(distribution) }),
    },
    updateDistribution: {
      ...updateDistribution,
      mutate: (distribution: Distribution, opts?: MutateOptions) =>
        updateDistribution.mutate(
          { params: { id: String(distribution.id) }, body: toUpdateBody(distribution) },
          opts,
        ),
      mutateAsync: (distribution: Distribution) =>
        updateDistribution.mutateAsync({
          params: { id: String(distribution.id) },
          body: toUpdateBody(distribution),
        }),
    },
    changeDistributionStatus: {
      ...changeDistributionStatus,
      mutateAsync: (distributionId: string, body: DistributionStatusChange) =>
        changeDistributionStatus.mutateAsync({ params: { id: distributionId }, body }),
    },
    reverseRedemption: {
      ...reverseRedemption,
      mutateAsync: (redemptionId: string, body: ReverseRedemptionBody) =>
        reverseRedemption.mutateAsync({ params: { id: redemptionId }, body }),
    },
    redeemCard: {
      ...redeemCard,
      mutate: (distributionId: string, body: RedeemCardBody, opts?: MutateOptions) =>
        redeemCard.mutate({ params: { id: distributionId }, body }, opts),
      mutateAsync: (distributionId: string, body: RedeemCardBody) =>
        redeemCard.mutateAsync({ params: { id: distributionId }, body }),
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
