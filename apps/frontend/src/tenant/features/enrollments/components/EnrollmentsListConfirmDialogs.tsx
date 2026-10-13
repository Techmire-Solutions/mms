import { ModuleTrashConfirmDialogs } from "@/components/app/ModuleTrashConfirmDialogs";
import { useTranslation } from "@/hooks/useTranslation";

export interface EnrollmentsListConfirmDialogsProps {
  pendingDeleteId: string | null;
  onPendingDeleteChange: (id: string | null) => void;
  onConfirmDelete: (reason?: string) => void;
  bulkDeleteCount: number;
  bulkDeleteOpen: boolean;
  onBulkDeleteOpenChange: (open: boolean) => void;
  bulkRestoreOpen: boolean;
  onBulkRestoreOpenChange: (open: boolean) => void;
  onConfirmBulkDelete: (reason?: string) => void;
  onConfirmBulkRestore: () => void;
}

/**
 * Soft-delete confirm trio for Enrollments Work (single-archive + bulk bar).
 */
export function EnrollmentsListConfirmDialogs({
  pendingDeleteId,
  onPendingDeleteChange,
  onConfirmDelete,
  bulkDeleteCount,
  bulkDeleteOpen,
  onBulkDeleteOpenChange,
  bulkRestoreOpen,
  onBulkRestoreOpenChange,
  onConfirmBulkDelete,
  onConfirmBulkRestore,
}: EnrollmentsListConfirmDialogsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleTrashConfirmDialogs
      pendingDeleteOpen={pendingDeleteId != null}
      onPendingDeleteOpenChange={(open) => {
        if (!open) onPendingDeleteChange(null);
      }}
      bulkDeleteOpen={bulkDeleteOpen}
      onBulkDeleteOpenChange={onBulkDeleteOpenChange}
      bulkRestoreOpen={bulkRestoreOpen}
      onBulkRestoreOpenChange={onBulkRestoreOpenChange}
      singleDeleteTitle={t("enrollments.confirmDeleteTitle")}
      singleDeleteDescription={t("enrollments.confirmDeleteDescription")}
      bulkDeleteTitle={t("enrollments.confirmBulkDeleteTitle", { count: bulkDeleteCount })}
      bulkDeleteDescription={t("enrollments.confirmBulkDeleteDescription")}
      bulkRestoreTitle={t("enrollments.confirmBulkRestoreTitle", { count: bulkDeleteCount })}
      bulkRestoreDescription={t("enrollments.confirmBulkRestoreDescription")}
      deleteConfirmLabel={t("enrollments.archive")}
      restoreConfirmLabel={t("enrollments.restore")}
      cancelLabel={t("common.cancel")}
      deletionReasonLabel={t("enrollments.deletionReasonLabel")}
      deletionReasonPlaceholder={t("enrollments.deletionReasonPlaceholder")}
      onConfirmSingleDelete={onConfirmDelete}
      onConfirmBulkDelete={onConfirmBulkDelete}
      onConfirmBulkRestore={onConfirmBulkRestore}
    />
  );
}
