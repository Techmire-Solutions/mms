import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import type { useHasanatMutations } from "@/tenant/features/hasanat/hooks/useHasanatApi";

type HasanatTrashMutations = Pick<
  ReturnType<typeof useHasanatMutations>,
  | "deleteDistribution"
  | "restoreDistribution"
  | "bulkDeleteDistributions"
  | "bulkRestoreDistributions"
>;

export function useHasanatDistributionTrashActions(mutations: HasanatTrashMutations) {
  const { t } = useTranslation();
  const {
    deleteDistribution,
    restoreDistribution,
    bulkDeleteDistributions,
    bulkRestoreDistributions,
  } = mutations;

  const handleDeleteDistribution = async (id: string) => {
    try {
      await deleteDistribution.mutateAsync(id);
      notify.success(t("hasanat.trash.deleted"));
    } catch (error: unknown) {
      notify.error(t("hasanat.trash.actionFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const handleRestoreDistribution = async (id: string) => {
    try {
      await restoreDistribution.mutateAsync(id);
      notify.success(t("hasanat.trash.restored"));
    } catch (error: unknown) {
      notify.error(t("hasanat.trash.actionFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      const result = await bulkDeleteDistributions.mutateAsync(ids);
      if (result.failed > 0) {
        notify.warning(
          t("hasanat.trash.bulkPartial", {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else {
        notify.success(
          result.succeeded > 1
            ? t("hasanat.trash.bulkDeleted", { count: result.succeeded })
            : t("hasanat.trash.deleted"),
        );
      }
    } catch (error: unknown) {
      notify.error(t("hasanat.trash.actionFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const handleBulkRestore = async (ids: string[]) => {
    try {
      const result = await bulkRestoreDistributions.mutateAsync(ids);
      if (result.failed > 0) {
        notify.warning(
          t("hasanat.trash.bulkPartial", {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else {
        notify.success(
          result.succeeded > 1
            ? t("hasanat.trash.bulkRestored", { count: result.succeeded })
            : t("hasanat.trash.restored"),
        );
      }
    } catch (error: unknown) {
      notify.error(t("hasanat.trash.actionFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  return {
    handleDeleteDistribution,
    handleRestoreDistribution,
    handleBulkDelete,
    handleBulkRestore,
  };
}
