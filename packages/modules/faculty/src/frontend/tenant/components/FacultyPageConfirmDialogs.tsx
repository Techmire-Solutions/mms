import { ModuleTrashConfirmDialogs } from "@mms/fe-core/components/ModuleTrashConfirmDialogs";
import { useTranslation } from "@mms/fe-core/i18n";
import type { FacultyDeleteTarget } from "../hooks/useFacultyPageOverlayState";

export interface FacultyPageConfirmDialogsProps {
  bulkDeleteOpen: boolean;
  onBulkDeleteOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirmBulkDelete: (reason?: string) => void | Promise<void>;
  deleteTarget: FacultyDeleteTarget | null;
  onDeleteTargetOpenChange: (open: boolean) => void;
  onConfirmSingleDelete: (reason?: string) => void | Promise<void>;
  bulkRestoreOpen: boolean;
  onBulkRestoreOpenChange: (open: boolean) => void;
  onConfirmBulkRestore: () => void | Promise<void>;
}

/** Delete/restore confirm dialogs for Faculty page (Contacts-shaped thin adapter). */
export function FacultyPageConfirmDialogs({
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
}: FacultyPageConfirmDialogsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleTrashConfirmDialogs
      pendingDeleteOpen={deleteTarget !== null}
      onPendingDeleteOpenChange={onDeleteTargetOpenChange}
      bulkDeleteOpen={bulkDeleteOpen}
      onBulkDeleteOpenChange={onBulkDeleteOpenChange}
      bulkRestoreOpen={bulkRestoreOpen}
      onBulkRestoreOpenChange={onBulkRestoreOpenChange}
      singleDeleteTitle={t("faculty.confirmDeleteTitle")}
      singleDeleteDescription={
        deleteTarget?.name
          ? t("faculty.deleteConfirmDescriptionNamed", { name: deleteTarget.name })
          : t("faculty.confirmDeleteDescription")
      }
      bulkDeleteTitle={t("faculty.bulkDelete")}
      bulkDeleteDescription={t("faculty.bulkDeleteConfirm", { count: selectedCount })}
      bulkRestoreTitle={t("faculty.bulkRestore")}
      bulkRestoreDescription={t("faculty.bulkRestoreConfirm", { count: selectedCount })}
      deleteConfirmLabel={t("common.delete")}
      restoreConfirmLabel={t("faculty.restore")}
      cancelLabel={t("common.cancel")}
      deletionReasonLabel={t("faculty.deletionReasonLabel")}
      deletionReasonPlaceholder={t("faculty.deletionReasonPlaceholder")}
      onConfirmSingleDelete={onConfirmSingleDelete}
      onConfirmBulkDelete={onConfirmBulkDelete}
      onConfirmBulkRestore={onConfirmBulkRestore}
    />
  );
}
