import { useState } from "react";

export interface UseExaminationsTrashStateProps {
  showDeleted?: boolean;
  selectedIds?: string[];
  onDelete?: (id: string) => void | Promise<void>;
  onRestore?: (id: string) => void | Promise<void>;
  onBulkDelete?: (ids: string[]) => void | Promise<void>;
  onBulkRestore?: (ids: string[]) => void | Promise<void>;
  onClearSelection?: () => void;
}

export function useExaminationsTrashState({
  showDeleted = false,
  selectedIds = [],
  onDelete,
  onRestore: _onRestore,
  onBulkDelete,
  onBulkRestore,
  onClearSelection,
}: UseExaminationsTrashStateProps) {
  const [pendingTrashId, setPendingTrashId] = useState<string | null>(null);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);

  const confirmRowTrash = (): void => {
    if (!pendingTrashId) return;
    void onDelete?.(pendingTrashId);
    setPendingTrashId(null);
  };

  const confirmBulkTrash = (): void => {
    if (showDeleted) void onBulkRestore?.(selectedIds);
    else void onBulkDelete?.(selectedIds);
    onClearSelection?.();
    setConfirmBulkOpen(false);
  };

  return {
    pendingTrashId,
    setPendingTrashId,
    confirmBulkOpen,
    setConfirmBulkOpen,
    confirmRowTrash,
    confirmBulkTrash,
  };
}
