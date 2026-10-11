import React from "react";
import { ModuleTrashConfirmDialogs } from "@/components/ui/ModuleTrashConfirmDialogs";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface AttendanceRecordsConfirmDialogsProps {
  pendingDeleteId: string | null;
  onPendingDeleteChange: (id: string | null) => void;
  onConfirmDelete: (id: string) => void;
  confirmBulkOpen: boolean;
  onConfirmBulkOpenChange: (open: boolean) => void;
  showDeleted: boolean;
  selectedIdsCount: number;
  onConfirmBulkTrash: () => void;
  t: TranslationFunction;
}

export function AttendanceRecordsConfirmDialogs({
  pendingDeleteId,
  onPendingDeleteChange,
  onConfirmDelete,
  confirmBulkOpen,
  onConfirmBulkOpenChange,
  showDeleted,
  selectedIdsCount,
  onConfirmBulkTrash,
  t,
}: AttendanceRecordsConfirmDialogsProps): React.JSX.Element {
  return (
    <ModuleTrashConfirmDialogs
      pendingTrashId={pendingDeleteId}
      onPendingTrashIdChange={onPendingDeleteChange}
      confirmBulkOpen={confirmBulkOpen}
      onConfirmBulkOpenChange={onConfirmBulkOpenChange}
      showDeleted={showDeleted}
      selectedCount={selectedIdsCount}
      i18nNamespace="attendance"
      onConfirmRowTrash={() => {
        const id = pendingDeleteId;
        onPendingDeleteChange(null);
        if (id) onConfirmDelete(id);
      }}
      onConfirmBulkTrash={onConfirmBulkTrash}
      labels={{
        singleTitle: t("attendance.confirmArchiveTitle"),
        singleDescription: t("attendance.confirmArchiveDescription"),
        singleConfirm: t("attendance.archive"),
        bulkDeleteTitle: t("attendance.confirmArchiveTitle"),
      }}
    />
  );
}
