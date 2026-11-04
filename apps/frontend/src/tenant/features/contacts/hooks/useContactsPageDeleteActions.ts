import { useCallback } from "react";
import { getDisplayName, type Contact } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import type { useContactsCrudActions } from "@/tenant/features/contacts/hooks/useContactsCrudActions";

type CrudActions = ReturnType<typeof useContactsCrudActions>;

export function useContactsPageDeleteActions({
  canDelete,
  selected,
  setSelected,
  deleteTarget,
  setDeleteTarget,
  setBulkDeleteOpen,
  setBulkRestoreOpen,
  findContactById,
  crud,
}: {
  canDelete: boolean;
  selected: Array<string | number>;
  setSelected: (ids: Array<string | number>) => void;
  deleteTarget: { id: string | number; name?: string } | null;
  setDeleteTarget: (target: { id: string | number; name?: string } | null) => void;
  setBulkDeleteOpen: (open: boolean) => void;
  setBulkRestoreOpen: (open: boolean) => void;
  findContactById: (id: string | number) => Contact | undefined;
  crud: Pick<
    CrudActions,
    | "handleError"
    | "notifyBulkResult"
    | "removeContact"
    | "bulkDeleteContactsAction"
    | "restoreContactAction"
    | "bulkRestoreContactsAction"
  >;
}) {
  const { t } = useTranslation();
  const {
    handleError,
    notifyBulkResult,
    removeContact,
    bulkDeleteContactsAction,
    restoreContactAction,
    bulkRestoreContactsAction,
  } = crud;

  const handleDelete = useCallback(
    (id: string | number) => {
      if (!canDelete) return;
      const selectedContact = findContactById(id);
      setDeleteTarget({ id, name: selectedContact ? getDisplayName(selectedContact) : undefined });
    },
    [canDelete, findContactById, setDeleteTarget],
  );

  const confirmSingleDelete = useCallback(
    (deletionReason?: string) => {
      if (!deleteTarget || !canDelete) return;
      setDeleteTarget(null);
      void removeContact(deleteTarget.id, deleteTarget.name, deletionReason);
    },
    [deleteTarget, canDelete, setDeleteTarget, removeContact],
  );

  const checkBulkAllowed = useCallback(
    () => canDelete && selected.length > 0,
    [canDelete, selected.length],
  );

  const requestBulkDelete = useCallback(() => {
    if (checkBulkAllowed()) setBulkDeleteOpen(true);
  }, [checkBulkAllowed, setBulkDeleteOpen]);

  const confirmBulkDelete = useCallback(
    (deletionReason?: string) => {
      if (!checkBulkAllowed()) return;
      setBulkDeleteOpen(false);
      void bulkDeleteContactsAction(selected, deletionReason).then(() => setSelected([]));
    },
    [checkBulkAllowed, setBulkDeleteOpen, bulkDeleteContactsAction, selected, setSelected],
  );

  const requestBulkRestore = useCallback(() => {
    if (checkBulkAllowed()) setBulkRestoreOpen(true);
  }, [checkBulkAllowed, setBulkRestoreOpen]);

  const confirmBulkRestore = useCallback(() => {
    if (!checkBulkAllowed()) return;
    setBulkRestoreOpen(false);
    void bulkRestoreContactsAction(selected)
      .then((result) => {
        const conflictDetail = result.conflicts?.[0]?.errors?.[0]?.message;
        notifyBulkResult(
          result.succeeded,
          result.failed,
          "contacts.restoreSuccessTitle",
          "contacts.bulkRestoreSuccess",
          conflictDetail,
        );
        setSelected([]);
      })
      .catch((err) => {
        handleError(err, "contacts.bulk_restore", "contacts.restoreFailed");
      });
  }, [
    checkBulkAllowed,
    setBulkRestoreOpen,
    bulkRestoreContactsAction,
    selected,
    notifyBulkResult,
    setSelected,
    handleError,
  ]);

  const handleRestore = useCallback(
    async (id: string | number) => {
      if (!canDelete) return;
      const selectedContact = findContactById(id);
      const name = selectedContact ? getDisplayName(selectedContact) : undefined;
      try {
        await restoreContactAction(String(id));
        notify.success(t("contacts.restoreSuccessTitle"), {
          description: name
            ? t("contacts.restoreSuccessDescription", { name })
            : t("contacts.restoreSuccessDescriptionDefault"),
        });
      } catch (err) {
        // The toast is the UI contract here: row-action callers invoke this from a
        // menu click without awaiting, so rethrowing produced unhandled rejections.
        handleError(err, "contacts.restore_single", "contacts.restoreFailed");
      }
    },
    [canDelete, findContactById, restoreContactAction, t, handleError],
  );

  return {
    handleDelete,
    confirmSingleDelete,
    requestBulkDelete,
    confirmBulkDelete,
    requestBulkRestore,
    confirmBulkRestore,
    handleRestore,
  };
}
