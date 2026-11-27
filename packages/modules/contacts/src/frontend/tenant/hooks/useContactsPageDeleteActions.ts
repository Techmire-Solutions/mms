import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDisplayName, type Contact } from "@mms/contracts";
import { apiContract } from "@mms/fe-core/api/tsRest";
import { useTranslation } from "@mms/fe-core/i18n";
import { notify } from "@mms/fe-core/notify";
import { invalidateContactsQueries } from "./invalidateContactsQueries.js";
import type { useContactsCrudActions } from "./useContactsCrudActions.js";

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
  const queryClient = useQueryClient();
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

  const handlePermanentDelete = useCallback(
    async (id: string | number) => {
      if (!canDelete) return;
      if (
        typeof window !== "undefined" &&
        !window.confirm(t("contacts.trash.permanentDeleteConfirm"))
      ) {
        return;
      }
      try {
        const res = await apiContract.contacts.permanentDelete({
          params: { id: String(id) },
          body: undefined,
        });
        if (res.status !== 200) {
          const msg =
            res.body && typeof res.body === "object" && "message" in res.body
              ? String((res.body as { message?: string }).message)
              : t("contacts.deleteFailed");
          notify.error(msg);
          return;
        }
        await invalidateContactsQueries(queryClient);
        notify.success(t("contacts.trash.permanentDeletedSuccess"));
      } catch (err) {
        handleError(err, "contacts.permanent_delete", "contacts.deleteFailed");
      }
    },
    [canDelete, t, queryClient, handleError],
  );

  const requestBulkPermanentDelete = useCallback(async () => {
    if (!checkBulkAllowed()) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(t("contacts.trash.permanentDeleteConfirm"))
    ) {
      return;
    }
    try {
      const res = await apiContract.contacts.bulkPermanentDelete({
        body: { ids: selected.map(String) },
      });
      if (res.status !== 200) {
        notify.error(t("contacts.deleteFailed"));
        return;
      }
      await invalidateContactsQueries(queryClient);
      const body =
        res.body && typeof res.body === "object"
          ? (res.body as { succeeded?: number; failed?: number })
          : undefined;
      const succeeded = typeof body?.succeeded === "number" ? body.succeeded : selected.length;
      const failed = typeof body?.failed === "number" ? body.failed : 0;
      notifyBulkResult(
        succeeded,
        failed,
        "contacts.trash.permanentDeletedSuccess",
        "contacts.trash.permanentDeletedSuccess",
      );
      setSelected([]);
    } catch (err) {
      handleError(err, "contacts.bulk_permanent_delete", "contacts.deleteFailed");
    }
  }, [checkBulkAllowed, t, selected, queryClient, notifyBulkResult, setSelected, handleError]);

  return {
    handleDelete,
    confirmSingleDelete,
    requestBulkDelete,
    confirmBulkDelete,
    requestBulkRestore,
    confirmBulkRestore,
    handleRestore,
    handlePermanentDelete,
    requestBulkPermanentDelete,
  };
}
