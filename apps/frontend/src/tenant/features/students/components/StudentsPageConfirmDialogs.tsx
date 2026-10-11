import { ModuleTrashConfirmDialogs } from "@/components/ui/ModuleTrashConfirmDialogs";
import { useTranslation } from "@/hooks/useTranslation";
import type { StudentsDeleteTarget } from "@/tenant/features/students/hooks/useStudentsPageOverlayState";

export interface StudentsPageConfirmDialogsProps {
  bulkDeleteOpen: boolean;
  onBulkDeleteOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirmBulkDelete: (reason?: string) => void | Promise<void>;
  deleteTarget: StudentsDeleteTarget | null;
  onDeleteTargetOpenChange: (open: boolean) => void;
  onConfirmSingleDelete: (reason?: string) => void | Promise<void>;
  bulkRestoreOpen: boolean;
  onBulkRestoreOpenChange: (open: boolean) => void;
  onConfirmBulkRestore: () => void | Promise<void>;
}

/** Delete/restore confirm dialogs for Students page (Contacts-shaped thin adapter). */
export function StudentsPageConfirmDialogs({
  bulkDeleteOpen,
  onBulkDeleteOpenChange,
  selectedCount,
  onConfirmBulkDelete,
  deleteTarget,
  onDeleteTargetOpenChange,
  onConfirmSingleDelete,
  bulkRestoreOpen,
  onBulkRestoreOpenChange,
  onConfirmBulkRestore,
}: StudentsPageConfirmDialogsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleTrashConfirmDialogs
      pendingDeleteOpen={deleteTarget !== null}
      onPendingDeleteOpenChange={onDeleteTargetOpenChange}
      bulkDeleteOpen={bulkDeleteOpen}
      onBulkDeleteOpenChange={onBulkDeleteOpenChange}
      bulkRestoreOpen={bulkRestoreOpen}
      onBulkRestoreOpenChange={onBulkRestoreOpenChange}
      singleDeleteTitle={t("students.deleteConfirmTitle")}
      singleDeleteDescription={
        deleteTarget?.name
          ? t("students.deleteConfirmDescriptionNamed", { name: deleteTarget.name })
          : t("students.deleteConfirmDescription")
      }
      bulkDeleteTitle={t("students.bulkDelete")}
      bulkDeleteDescription={t("students.list.confirmRemoveSelected", { count: selectedCount })}
      bulkRestoreTitle={t("students.bulkRestore")}
      bulkRestoreDescription={t("students.bulkRestoreConfirm", { count: selectedCount })}
      deleteConfirmLabel={t("students.list.remove")}
      restoreConfirmLabel={t("students.restore")}
      cancelLabel={t("common.cancel")}
      deletionReasonLabel={t("students.deletionReasonLabel")}
      deletionReasonPlaceholder={t("students.deletionReasonPlaceholder")}
      onConfirmSingleDelete={onConfirmSingleDelete}
      onConfirmBulkDelete={onConfirmBulkDelete}
      onConfirmBulkRestore={onConfirmBulkRestore}
    />
  );
}
