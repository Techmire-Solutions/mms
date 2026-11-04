import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import type { TaskStatus } from "@mms/shared";
import {
  useBulkDeleteTasks,
  useBulkRestoreTasks,
  useBulkUpdateTaskStatus,
} from "@/tenant/hooks/collections/tasks";

/** Bulk archive/restore/status handlers, kept out of the Work tier render file. */
export function useTasksBulkActions(selectedIds: string[], onClearSelection: () => void) {
  const { t } = useTranslation();
  const bulkDeleteMutation = useBulkDeleteTasks();
  const bulkRestoreMutation = useBulkRestoreTasks();
  const bulkStatusMutation = useBulkUpdateTaskStatus();

  const handleBulkDelete = () => {
    if (!selectedIds.length) return;
    const targets = [...selectedIds];
    bulkDeleteMutation.mutate(targets, {
      onSuccess: ({ deletedIds, skipped = [] }) => {
        onClearSelection();
        if (deletedIds.length > 0) {
          notify.archivedWithUndo(t("common.recordArchived"), () => {
            void bulkRestoreMutation.mutateAsync(deletedIds);
          });
        }
        if (skipped.length > 0) {
          notify.warning(
            t("tasks.bulkSkipped", { count: deletedIds.length, skipped: skipped.length }),
          );
        }
      },
      onError: (err) => {
        notify.error(err instanceof Error ? err.message : t("tasks.deleteFailed"));
      },
    });
  };

  const handleBulkRestore = () => {
    if (!selectedIds.length) return;
    bulkRestoreMutation.mutate([...selectedIds], {
      onSuccess: ({ restoredIds, skipped = [] }) => {
        onClearSelection();
        notify.success(t("tasks.restored"));
        if (skipped.length > 0) {
          notify.warning(
            t("tasks.bulkSkipped", { count: restoredIds.length, skipped: skipped.length }),
          );
        }
      },
      onError: (err) => {
        notify.error(err instanceof Error ? err.message : t("tasks.restoreFailed"));
      },
    });
  };

  const handleBulkStatusChange = (status: string) => {
    if (!selectedIds.length) return;
    const targets = [...selectedIds];
    bulkStatusMutation.mutate(
      { ids: targets, status: status as TaskStatus },
      {
        onSuccess: ({ updatedIds, skipped = [] }) => {
          onClearSelection();
          if (updatedIds.length > 0) {
            notify.success(t("tasks.bulkStatusSuccess", { count: updatedIds.length }));
          }
          if (skipped.length > 0) {
            notify.warning(
              t("tasks.bulkSkipped", { count: updatedIds.length, skipped: skipped.length }),
            );
          }
        },
        onError: (err) => {
          notify.error(err instanceof Error ? err.message : t("tasks.bulkStatusFailed"));
        },
      },
    );
  };

  return {
    handleBulkDelete,
    handleBulkRestore,
    handleBulkStatusChange,
    isStatusPending: bulkStatusMutation.isPending,
  };
}
