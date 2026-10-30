import { useQueryClient } from "@tanstack/react-query";
import type {
  ObligationType,
  Mujtahid,
  MujtahidRep,
  WakalaType,
  ObligationDistribution,
  ObligationCollection,
} from "@mms/shared";
import { tsrClient } from "@/lib/api";
import { invalidateObligationsQueries } from "@/tenant/features/obligations/hooks/invalidateObligationsQueries";
import { contractBodyOrThrow } from "@/lib/apiContractError";

export function useObligationsMutations() {
  const queryClient = useQueryClient();

  const invalidateCollections = () => {
    invalidateObligationsQueries(queryClient);
  };

  const _replaceTypes = tsrClient.obligations.replaceTypes.useMutation({
    onSuccess: () => invalidateObligationsQueries(queryClient),
  });
  const replaceTypes = {
    ..._replaceTypes,
    mutateAsync: async (types: ObligationType[]) => {
      const res = await _replaceTypes.mutateAsync({ body: types });
      return contractBodyOrThrow(res, "Failed to update obligation types");
    },
  };

  const _replaceMujtahids = tsrClient.obligations.replaceMujtahids.useMutation({
    onSuccess: () => invalidateObligationsQueries(queryClient),
  });
  const replaceMujtahids = {
    ..._replaceMujtahids,
    mutateAsync: async (mujtahids: Mujtahid[]) => {
      const res = await _replaceMujtahids.mutateAsync({ body: mujtahids });
      return contractBodyOrThrow(res, "Failed to update mujtahids");
    },
  };

  const _replaceReps = tsrClient.obligations.replaceReps.useMutation({
    onSuccess: () => invalidateObligationsQueries(queryClient),
  });
  const replaceReps = {
    ..._replaceReps,
    mutateAsync: async (reps: MujtahidRep[]) => {
      const res = await _replaceReps.mutateAsync({ body: reps });
      return contractBodyOrThrow(res, "Failed to update mujtahid reps");
    },
  };

  const _replaceWakala = tsrClient.obligations.replaceWakala.useMutation({
    onSuccess: () => invalidateObligationsQueries(queryClient),
  });
  const replaceWakala = {
    ..._replaceWakala,
    mutateAsync: async (wakalaTypes: WakalaType[]) => {
      const res = await _replaceWakala.mutateAsync({ body: wakalaTypes });
      return contractBodyOrThrow(res, "Failed to update wakala types");
    },
  };

  const _replaceDistributions = tsrClient.obligations.replaceDistributions.useMutation({
    onSuccess: () => invalidateObligationsQueries(queryClient),
  });
  const replaceDistributions = {
    ..._replaceDistributions,
    mutateAsync: async (distributions: ObligationDistribution[]) => {
      const res = await _replaceDistributions.mutateAsync({ body: distributions });
      return contractBodyOrThrow(res, "Failed to update obligation distributions");
    },
  };

  const _replaceCollections = tsrClient.obligations.replaceCollections.useMutation({
    onSuccess: () => invalidateCollections(),
  });
  const replaceCollections = {
    ..._replaceCollections,
    mutateAsync: async (collections: ObligationCollection[]) => {
      const res = await _replaceCollections.mutateAsync({ body: collections });
      return contractBodyOrThrow(res, "Failed to update obligation collections");
    },
  };

  const _deleteCollection = tsrClient.obligations.deleteCollection.useMutation({
    onSuccess: () => invalidateCollections(),
  });
  const deleteCollection = {
    ..._deleteCollection,
    mutateAsync: async (id: string) => {
      const res = await _deleteCollection.mutateAsync({ params: { id } });
      return contractBodyOrThrow(res, "Failed to delete obligation collection");
    },
  };

  const _restoreCollection = tsrClient.obligations.restoreCollection.useMutation({
    onSuccess: () => invalidateCollections(),
  });
  const restoreCollection = {
    ..._restoreCollection,
    mutateAsync: async (id: string) => {
      const res = await _restoreCollection.mutateAsync({ params: { id } });
      return contractBodyOrThrow(res, "Failed to restore obligation collection");
    },
  };

  const _bulkDeleteCollections = tsrClient.obligations.bulkDeleteCollections.useMutation({
    onSuccess: () => invalidateCollections(),
  });
  const bulkDeleteCollections = {
    ..._bulkDeleteCollections,
    mutateAsync: async (ids: string[]) => {
      const res = await _bulkDeleteCollections.mutateAsync({ body: { ids } });
      return contractBodyOrThrow(res, "Failed to bulk delete obligation collections");
    },
  };

  const _bulkRestoreCollections = tsrClient.obligations.bulkRestoreCollections.useMutation({
    onSuccess: () => invalidateCollections(),
  });
  const bulkRestoreCollections = {
    ..._bulkRestoreCollections,
    mutateAsync: async (ids: string[]) => {
      const res = await _bulkRestoreCollections.mutateAsync({ body: { ids } });
      return contractBodyOrThrow(res, "Failed to bulk restore obligation collections");
    },
  };

  return {
    replaceTypes,
    replaceMujtahids,
    replaceReps,
    replaceWakala,
    replaceDistributions,
    replaceCollections,
    deleteCollection,
    restoreCollection,
    bulkDeleteCollections,
    bulkRestoreCollections,
  };
}
