import { useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";

export interface UseOptimisticSoftDeleteOptions<TData> {
  queryClient: QueryClient;
  queryKey: readonly unknown[];
  removeFromSnapshot: (snapshot: TData, id: string) => TData;
  deleteFn: (id: string, reason?: string) => Promise<void>;
  restoreFn: (id: string) => Promise<void>;
  notifyArchivedWithUndo: (onUndo: () => void | Promise<void>, recordName?: string) => void;
}

export function useOptimisticSoftDelete<TData>({
  queryClient,
  queryKey,
  removeFromSnapshot,
  deleteFn,
  restoreFn,
  notifyArchivedWithUndo,
}: UseOptimisticSoftDeleteOptions<TData>): {
  optimisticDelete: (id: string, recordName?: string, reason?: string) => Promise<void>;
} {
  const optimisticDelete = useCallback(
    async (id: string, recordName?: string, reason?: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<TData>(queryKey);

      if (previousData !== undefined) {
        queryClient.setQueryData<TData>(queryKey, removeFromSnapshot(previousData, id));
      }

      try {
        await deleteFn(id, reason);
      } catch (err) {
        if (previousData !== undefined) {
          queryClient.setQueryData<TData>(queryKey, previousData);
        }
        throw err;
      }

      notifyArchivedWithUndo(async () => {
        await restoreFn(id);
        await queryClient.invalidateQueries({ queryKey });
      }, recordName);
    },
    [queryClient, queryKey, removeFromSnapshot, deleteFn, restoreFn, notifyArchivedWithUndo],
  );

  return { optimisticDelete };
}
