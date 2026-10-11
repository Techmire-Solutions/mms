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
import {
  OBLIGATIONS_TYPES_QUERY_KEY,
  OBLIGATIONS_MUJTAHIDS_QUERY_KEY,
  OBLIGATIONS_REPS_QUERY_KEY,
  OBLIGATIONS_WAKALA_QUERY_KEY,
  OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY,
  OBLIGATIONS_COLLECTIONS_QUERY_KEY,
  OBLIGATIONS_METRICS_QUERY_KEY,
} from "@/tenant/features/obligations/hooks/obligationsQueryKeys";

function assertSuccess<T>(res: { status: number; body: T }, fallbackMsg: string): T {
  if (res.status < 200 || res.status >= 300) {
    const errorMsg = (res.body as { message?: string })?.message || fallbackMsg;
    throw new Error(errorMsg);
  }
  return res.body;
}

export function useObligationsMutations() {
  const queryClient = useQueryClient();

  const invalidateCollections = () => {
    void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_COLLECTIONS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_METRICS_QUERY_KEY });
  };

  // @ts-expect-error - TS union discrimination limit with ts-rest

  const _replaceTypes = tsrClient.obligations.replaceTypes.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_TYPES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_METRICS_QUERY_KEY });
    },
  });
  const replaceTypes = {
    ..._replaceTypes,
    mutateAsync: async (types: ObligationType[]) => {
      const res = await _replaceTypes.mutateAsync({ body: types });
      return assertSuccess(res, "Failed to update obligation types");
    },
  };

  // @ts-expect-error - TS union discrimination limit with ts-rest

  const _replaceMujtahids = tsrClient.obligations.replaceMujtahids.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_MUJTAHIDS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_METRICS_QUERY_KEY });
    },
  });
  const replaceMujtahids = {
    ..._replaceMujtahids,
    mutateAsync: async (mujtahids: Mujtahid[]) => {
      const res = await _replaceMujtahids.mutateAsync({ body: mujtahids });
      return assertSuccess(res, "Failed to update mujtahids");
    },
  };

  // @ts-expect-error - TS union discrimination limit with ts-rest

  const _replaceReps = tsrClient.obligations.replaceReps.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_REPS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_METRICS_QUERY_KEY });
    },
  });
  const replaceReps = {
    ..._replaceReps,
    mutateAsync: async (reps: MujtahidRep[]) => {
      const res = await _replaceReps.mutateAsync({ body: reps });
      return assertSuccess(res, "Failed to update mujtahid reps");
    },
  };

  // @ts-expect-error - TS union discrimination limit with ts-rest

  const _replaceWakala = tsrClient.obligations.replaceWakala.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_WAKALA_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_METRICS_QUERY_KEY });
    },
  });
  const replaceWakala = {
    ..._replaceWakala,
    mutateAsync: async (wakalaTypes: WakalaType[]) => {
      const res = await _replaceWakala.mutateAsync({ body: wakalaTypes });
      return assertSuccess(res, "Failed to update wakala types");
    },
  };

  // @ts-expect-error - TS union discrimination limit with ts-rest

  const _replaceDistributions = tsrClient.obligations.replaceDistributions.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_METRICS_QUERY_KEY });
    },
  });
  const replaceDistributions = {
    ..._replaceDistributions,
    mutateAsync: async (distributions: ObligationDistribution[]) => {
      const res = await _replaceDistributions.mutateAsync({ body: distributions });
      return assertSuccess(res, "Failed to update obligation distributions");
    },
  };

  // @ts-expect-error - TS union discrimination limit with ts-rest

  const _replaceCollections = tsrClient.obligations.replaceCollections.useMutation({
    onSuccess: () => invalidateCollections(),
  });
  const replaceCollections = {
    ..._replaceCollections,
    mutateAsync: async (collections: ObligationCollection[]) => {
      const res = await _replaceCollections.mutateAsync({ body: collections });
      return assertSuccess(res, "Failed to update obligation collections");
    },
  };

  // @ts-expect-error - TS union discrimination limit with ts-rest

  const _deleteCollection = tsrClient.obligations.deleteCollection.useMutation({
    onSuccess: () => invalidateCollections(),
  });
  const deleteCollection = {
    ..._deleteCollection,
    mutateAsync: async (id: string) => {
      const res = await _deleteCollection.mutateAsync({ params: { id } });
      return assertSuccess(res, "Failed to delete obligation collection");
    },
  };

  // @ts-expect-error - TS union discrimination limit with ts-rest

  const _restoreCollection = tsrClient.obligations.restoreCollection.useMutation({
    onSuccess: () => invalidateCollections(),
  });
  const restoreCollection = {
    ..._restoreCollection,
    mutateAsync: async (id: string) => {
      const res = await _restoreCollection.mutateAsync({ params: { id } });
      return assertSuccess(res, "Failed to restore obligation collection");
    },
  };

  // @ts-expect-error - TS union discrimination limit with ts-rest

  const _bulkDeleteCollections = tsrClient.obligations.bulkDeleteCollections.useMutation({
    onSuccess: () => invalidateCollections(),
  });
  const bulkDeleteCollections = {
    ..._bulkDeleteCollections,
    mutateAsync: async (ids: string[]) => {
      const res = await _bulkDeleteCollections.mutateAsync({ body: { ids } });
      return assertSuccess(res, "Failed to bulk delete obligation collections");
    },
  };

  // @ts-expect-error - TS union discrimination limit with ts-rest

  const _bulkRestoreCollections = tsrClient.obligations.bulkRestoreCollections.useMutation({
    onSuccess: () => invalidateCollections(),
  });
  const bulkRestoreCollections = {
    ..._bulkRestoreCollections,
    mutateAsync: async (ids: string[]) => {
      const res = await _bulkRestoreCollections.mutateAsync({ body: { ids } });
      return assertSuccess(res, "Failed to bulk restore obligation collections");
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
