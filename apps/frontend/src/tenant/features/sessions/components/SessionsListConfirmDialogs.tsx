import { ModuleTrashConfirmDialogs } from "@/components/app/ModuleTrashConfirmDialogs";
import { useTranslation } from "@/hooks/useTranslation";

interface SessionsListConfirmDialogsProps {
  selectedCount: number;
  confirmBulkDeleteOpen: boolean;
  confirmBulkRestoreOpen: boolean;
  pendingDeleteId: string | null;
  onBulkDeleteOpenChange: (open: boolean) => void;
  onBulkRestoreOpenChange: (open: boolean) => void;
  onPendingDeleteChange: (id: string | null) => void;
  onConfirmBulkDelete: (reason?: string) => void;
  onConfirmBulkRestore: () => void;
  onConfirmDelete: (reason?: string) => void;
}

export function SessionsListConfirmDialogs({
  selectedCount,
  confirmBulkDeleteOpen,
  confirmBulkRestoreOpen,
  pendingDeleteId,
  onBulkDeleteOpenChange,
  onBulkRestoreOpenChange,
  onPendingDeleteChange,
  onConfirmBulkDelete,
  onConfirmBulkRestore,
  onConfirmDelete,
}: SessionsListConfirmDialogsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleTrashConfirmDialogs
      pendingDeleteOpen={pendingDeleteId != null}
      onPendingDeleteOpenChange={(open) => {
        if (!open) onPendingDeleteChange(null);
      }}
      bulkDeleteOpen={confirmBulkDeleteOpen}
      onBulkDeleteOpenChange={onBulkDeleteOpenChange}
      bulkRestoreOpen={confirmBulkRestoreOpen}
      onBulkRestoreOpenChange={onBulkRestoreOpenChange}
      singleDeleteTitle={t("sessions.confirmDeleteTitle")}
      singleDeleteDescription={t("sessions.confirmDeleteDescription")}
      bulkDeleteTitle={t("sessions.confirmDeleteTitle")}
      bulkDeleteDescription={t("sessions.bulkDeleteConfirm", { count: selectedCount })}
      bulkRestoreTitle={t("sessions.restore")}
      bulkRestoreDescription={t("sessions.bulkRestoreConfirm", { count: selectedCount })}
      deleteConfirmLabel={t("sessions.archive")}
      restoreConfirmLabel={t("sessions.restore")}
      cancelLabel={t("common.cancel")}
      deletionReasonLabel={t("sessions.deletionReasonLabel")}
      deletionReasonPlaceholder={t("sessions.deletionReasonPlaceholder")}
      onConfirmSingleDelete={onConfirmDelete}
      onConfirmBulkDelete={onConfirmBulkDelete}
      onConfirmBulkRestore={onConfirmBulkRestore}
    />
  );
}
