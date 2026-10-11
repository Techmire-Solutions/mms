import type { AppTranslationKey } from "@mms/shared";
import type { UseMutationResult } from "@tanstack/react-query";
import { useCallback } from "react";
import { notify } from "@/lib/notify";

interface BulkTrashResult {
  succeeded: number;
  failed: number;
}

interface UseObligationsTrashActionsOptions {
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string;
  deleteCollection: UseMutationResult<{ success: boolean }, Error, string, unknown>;
  restoreCollection: UseMutationResult<{ success: boolean }, Error, string, unknown>;
  bulkDeleteCollections: UseMutationResult<BulkTrashResult, Error, string[], unknown>;
  bulkRestoreCollections: UseMutationResult<BulkTrashResult, Error, string[], unknown>;
}

export function useObligationsTrashActions({
  t,
  deleteCollection,
  restoreCollection,
  bulkDeleteCollections,
  bulkRestoreCollections,
}: UseObligationsTrashActionsOptions) {
  const runTrashAction = useCallback(
    async (action: () => Promise<void>): Promise<void> => {
      try {
        await action();
      } catch (error: unknown) {
        notify.error(t("obligations.trash.actionFailed"), {
          description: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [t],
  );

  const handleDelete = async (id: string) => {
    await runTrashAction(async () => {
      await deleteCollection.mutateAsync(id);
      notify.success(t("obligations.trash.deleted"));
    });
  };

  const handleRestore = async (id: string) => {
    await runTrashAction(async () => {
      await restoreCollection.mutateAsync(id);
      notify.success(t("obligations.trash.restored"));
    });
  };

  const handleBulkDelete = async (ids: string[]) => {
    await runTrashAction(async () => {
      const result = await bulkDeleteCollections.mutateAsync(ids);
      if (result.failed > 0) {
        notify.warning(
          t("obligations.trash.bulkPartial", {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else {
        notify.success(
          result.succeeded > 1
            ? t("obligations.trash.bulkDeleted", { count: result.succeeded })
            : t("obligations.trash.deleted"),
        );
      }
    });
  };

  const handleBulkRestore = async (ids: string[]) => {
    await runTrashAction(async () => {
      const result = await bulkRestoreCollections.mutateAsync(ids);
      if (result.failed > 0) {
        notify.warning(
          t("obligations.trash.bulkPartial", {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else {
        notify.success(
          result.succeeded > 1
            ? t("obligations.trash.bulkRestored", { count: result.succeeded })
            : t("obligations.trash.restored"),
        );
      }
    });
  };

  return { handleDelete, handleRestore, handleBulkDelete, handleBulkRestore };
}
