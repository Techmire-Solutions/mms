import React from "react";
import { ModuleTrashConfirmDialogs } from "@/components/ui/ModuleTrashConfirmDialogs";

export interface HasanatTrashDialogsProps {
  pendingTrashId: string | null;
  onPendingTrashIdChange: (id: string | null) => void;
  confirmBulkOpen: boolean;
  onConfirmBulkOpenChange: (open: boolean) => void;
  showDeleted: boolean;
  selectedCount: number;
  onConfirmRowTrash: () => void;
  onConfirmBulkTrash: () => void;
}

export function HasanatTrashDialogs({
  pendingTrashId,
  onPendingTrashIdChange,
  confirmBulkOpen,
  onConfirmBulkOpenChange,
  showDeleted,
  selectedCount,
  onConfirmRowTrash,
  onConfirmBulkTrash,
}: HasanatTrashDialogsProps): React.JSX.Element {
  return (
    <ModuleTrashConfirmDialogs
      pendingTrashId={pendingTrashId}
      onPendingTrashIdChange={onPendingTrashIdChange}
      confirmBulkOpen={confirmBulkOpen}
      onConfirmBulkOpenChange={onConfirmBulkOpenChange}
      showDeleted={showDeleted}
      selectedCount={selectedCount}
      i18nNamespace="hasanat"
      onConfirmRowTrash={onConfirmRowTrash}
      onConfirmBulkTrash={onConfirmBulkTrash}
    />
  );
}
