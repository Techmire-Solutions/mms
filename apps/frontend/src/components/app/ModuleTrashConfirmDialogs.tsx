import React, { type JSX } from "react";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { useTranslation } from "@/hooks/useTranslation";
import type { AppTranslationKey } from "@mms/shared";

export interface ModuleTrashConfirmDialogsProps {
  // Mode 1: Trio state (single, bulk delete, bulk restore) with optional reason
  pendingDeleteOpen?: boolean;
  onPendingDeleteOpenChange?: (open: boolean) => void;
  bulkDeleteOpen?: boolean;
  onBulkDeleteOpenChange?: (open: boolean) => void;
  bulkRestoreOpen?: boolean;
  onBulkRestoreOpenChange?: (open: boolean) => void;

  // Mode 2: Simplified dual dialogs by ID and bulk state
  pendingTrashId?: string | null;
  onPendingTrashIdChange?: (id: string | null) => void;
  confirmBulkOpen?: boolean;
  onConfirmBulkOpenChange?: (open: boolean) => void;
  showDeleted?: boolean;
  selectedCount?: number;
  i18nNamespace?: string;

  // Callbacks
  onConfirmSingleDelete?: (reason?: string) => void | Promise<void | boolean>;
  onConfirmBulkDelete?: (reason?: string) => void | Promise<void | boolean>;
  onConfirmBulkRestore?: () => void | Promise<void | boolean>;
  onConfirmRowTrash?: () => void | Promise<void>;
  onConfirmBulkTrash?: () => void | Promise<void>;

  // Optional Reason
  deletionReasonLabel?: string;
  deletionReasonPlaceholder?: string;

  // Labels
  singleDeleteTitle?: string;
  singleDeleteDescription?: string;
  bulkDeleteTitle?: string;
  bulkDeleteDescription?: string;
  bulkRestoreTitle?: string;
  bulkRestoreDescription?: string;
  deleteConfirmLabel?: string;
  restoreConfirmLabel?: string;
  cancelLabel?: string;
  labels?: {
    singleTitle?: string;
    singleDescription?: string;
    singleConfirm?: string;
    bulkDeleteTitle?: string;
    bulkDeleteDescription?: string;
    bulkRestoreTitle?: string;
    bulkRestoreDescription?: string;
    bulkDeleteConfirm?: string;
    bulkRestoreConfirm?: string;
    cancel?: string;
  };
}

/**
 * Universal ModuleTrashConfirmDialogs SSOT primitive.
 * Handles single delete, bulk delete, and bulk restore dialogs with or without deletion reason prompts.
 */
export function ModuleTrashConfirmDialogs({
  pendingDeleteOpen,
  onPendingDeleteOpenChange,
  bulkDeleteOpen,
  onBulkDeleteOpenChange,
  bulkRestoreOpen,
  onBulkRestoreOpenChange,
  pendingTrashId,
  onPendingTrashIdChange,
  confirmBulkOpen,
  onConfirmBulkOpenChange,
  showDeleted = false,
  selectedCount = 0,
  i18nNamespace,
  onConfirmSingleDelete,
  onConfirmBulkDelete,
  onConfirmBulkRestore,
  onConfirmRowTrash,
  onConfirmBulkTrash,
  deletionReasonLabel,
  deletionReasonPlaceholder,
  singleDeleteTitle,
  singleDeleteDescription,
  bulkDeleteTitle,
  bulkDeleteDescription,
  bulkRestoreTitle,
  bulkRestoreDescription,
  deleteConfirmLabel,
  restoreConfirmLabel,
  cancelLabel,
  labels,
}: ModuleTrashConfirmDialogsProps): JSX.Element {
  const { t } = useTranslation();

  const reason = deletionReasonLabel
    ? {
        label: deletionReasonLabel,
        placeholder: deletionReasonPlaceholder || "",
      }
    : undefined;

  // If using Mode 2 (pendingTrashId / confirmBulkOpen)
  if (
    pendingTrashId !== undefined &&
    onPendingTrashIdChange &&
    confirmBulkOpen !== undefined &&
    onConfirmBulkOpenChange &&
    i18nNamespace
  ) {
    const sTitle =
      labels?.singleTitle ??
      singleDeleteTitle ??
      t(`${i18nNamespace}.trash.deleteTitle` as AppTranslationKey);
    const sDesc =
      labels?.singleDescription ??
      singleDeleteDescription ??
      t(`${i18nNamespace}.trash.deleteConfirm` as AppTranslationKey);
    const sConfirm = labels?.singleConfirm ?? deleteConfirmLabel ?? t("common.delete");
    const cLabel = labels?.cancel ?? cancelLabel ?? t("common.cancel");

    const bTitle = showDeleted
      ? (labels?.bulkRestoreTitle ??
        bulkRestoreTitle ??
        t(`${i18nNamespace}.trash.restore` as AppTranslationKey))
      : (labels?.bulkDeleteTitle ??
        bulkDeleteTitle ??
        t(`${i18nNamespace}.trash.deleteTitle` as AppTranslationKey));

    const bDesc = showDeleted
      ? (labels?.bulkRestoreDescription ??
        bulkRestoreDescription ??
        t(`${i18nNamespace}.trash.bulkRestoreConfirm` as AppTranslationKey, {
          count: selectedCount,
        }))
      : (labels?.bulkDeleteDescription ??
        bulkDeleteDescription ??
        t(`${i18nNamespace}.trash.bulkDeleteConfirm` as AppTranslationKey, {
          count: selectedCount,
        }));

    const bConfirm = showDeleted
      ? (labels?.bulkRestoreConfirm ??
        restoreConfirmLabel ??
        t(`${i18nNamespace}.trash.restore` as AppTranslationKey))
      : (labels?.bulkDeleteConfirm ?? deleteConfirmLabel ?? t("common.delete"));

    return (
      <>
        <ConfirmAlertDialog
          open={pendingTrashId !== null}
          onOpenChange={(open) => {
            if (!open) onPendingTrashIdChange(null);
          }}
          title={sTitle}
          description={sDesc}
          confirmLabel={sConfirm}
          cancelLabel={cLabel}
          onConfirm={onConfirmRowTrash ?? onConfirmSingleDelete ?? (() => {})}
          destructive
          optionalReason={reason}
        />
        <ConfirmAlertDialog
          open={confirmBulkOpen}
          onOpenChange={onConfirmBulkOpenChange}
          title={bTitle}
          description={bDesc}
          confirmLabel={bConfirm}
          cancelLabel={cLabel}
          onConfirm={onConfirmBulkTrash ?? onConfirmBulkDelete ?? (() => {})}
          destructive={!showDeleted}
          optionalReason={reason}
        />
      </>
    );
  }

  // Otherwise Mode 1 (trio)
  return (
    <>
      {pendingDeleteOpen !== undefined && onPendingDeleteOpenChange && (
        <ConfirmAlertDialog
          open={pendingDeleteOpen}
          onOpenChange={onPendingDeleteOpenChange}
          title={singleDeleteTitle || ""}
          description={singleDeleteDescription || ""}
          confirmLabel={deleteConfirmLabel}
          cancelLabel={cancelLabel}
          destructive
          optionalReason={reason}
          onConfirm={onConfirmSingleDelete ?? onConfirmRowTrash ?? (() => {})}
        />
      )}
      {bulkDeleteOpen !== undefined && onBulkDeleteOpenChange && (
        <ConfirmAlertDialog
          open={bulkDeleteOpen}
          onOpenChange={onBulkDeleteOpenChange}
          title={bulkDeleteTitle || ""}
          description={bulkDeleteDescription || ""}
          confirmLabel={deleteConfirmLabel}
          cancelLabel={cancelLabel}
          destructive
          optionalReason={reason}
          onConfirm={onConfirmBulkDelete ?? onConfirmBulkTrash ?? (() => {})}
        />
      )}
      {bulkRestoreOpen !== undefined && onBulkRestoreOpenChange && (
        <ConfirmAlertDialog
          open={bulkRestoreOpen}
          onOpenChange={onBulkRestoreOpenChange}
          title={bulkRestoreTitle || ""}
          description={bulkRestoreDescription || ""}
          confirmLabel={restoreConfirmLabel}
          cancelLabel={cancelLabel}
          onConfirm={onConfirmBulkRestore ?? (() => {})}
        />
      )}
    </>
  );
}
