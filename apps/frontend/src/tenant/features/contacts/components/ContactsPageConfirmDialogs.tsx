import type React from "react";
import { ModuleTrashConfirmDialogs } from "@/components/ui/ModuleTrashConfirmDialogs";
import { useTranslation } from "@/hooks/useTranslation";

export interface ContactsPageConfirmDialogsProps {
  bulkDeleteOpen: boolean;
  onBulkDeleteOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirmBulkDelete: (reason?: string) => void;
  deleteTarget: { id: string | number; name?: string } | null;
  onDeleteTargetOpenChange: (open: boolean) => void;
  onConfirmSingleDelete: (reason?: string) => void;
  bulkRestoreOpen: boolean;
  onBulkRestoreOpenChange: (open: boolean) => void;
  onConfirmBulkRestore: () => void;
}

/** Delete/restore confirm dialogs for Contacts page. */
export function ContactsPageConfirmDialogs({
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
}: ContactsPageConfirmDialogsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleTrashConfirmDialogs
      pendingDeleteOpen={deleteTarget !== null}
      onPendingDeleteOpenChange={onDeleteTargetOpenChange}
      bulkDeleteOpen={bulkDeleteOpen}
      onBulkDeleteOpenChange={onBulkDeleteOpenChange}
      bulkRestoreOpen={bulkRestoreOpen}
      onBulkRestoreOpenChange={onBulkRestoreOpenChange}
      singleDeleteTitle={t("contacts.deleteConfirmTitle")}
      singleDeleteDescription={
        deleteTarget?.name
          ? t("contacts.deleteConfirmDescription", { name: deleteTarget.name })
          : t("contacts.deleteConfirmDescriptionDefault")
      }
      bulkDeleteTitle={t("contacts.bulkDelete")}
      bulkDeleteDescription={t("contacts.bulkDeleteConfirm", { count: selectedCount })}
      bulkRestoreTitle={t("contacts.bulkRestore")}
      bulkRestoreDescription={t("contacts.bulkRestoreConfirm", { count: selectedCount })}
      deleteConfirmLabel={t("common.delete")}
      restoreConfirmLabel={t("contacts.restoreContact")}
      cancelLabel={t("common.cancel")}
      deletionReasonLabel={t("contacts.deletionReasonLabel")}
      deletionReasonPlaceholder={t("contacts.deletionReasonPlaceholder")}
      onConfirmSingleDelete={onConfirmSingleDelete}
      onConfirmBulkDelete={onConfirmBulkDelete}
      onConfirmBulkRestore={onConfirmBulkRestore}
    />
  );
}
