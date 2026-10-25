/**
 * @file TasksBulkActionBar.tsx
 * @description Bulk archive/restore chrome for Tasks Work selection.
 */

import { CheckSquare } from "lucide-react";
import { TASKS_MODULE_MANIFEST } from "@mms/shared";
import { BulkSelectionBar } from "@/components/app/BulkSelectionBar";

export interface TasksBulkActionBarProps {
  selectedCount: number;
  viewingDeleted: boolean;
  canDelete: boolean;
  onClearSelection: () => void;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  bulkActions?: readonly string[];
}

/** Tasks Work bulk bar — thin adapter delegating to shared BulkSelectionBar. */
export function TasksBulkActionBar({
  selectedCount,
  viewingDeleted,
  canDelete,
  onClearSelection,
  onRequestBulkDelete,
  onRequestBulkRestore,
  bulkActions = TASKS_MODULE_MANIFEST.work.bulkActions,
}: TasksBulkActionBarProps): React.JSX.Element | null {
  return (
    <BulkSelectionBar
      selectedCount={selectedCount}
      viewingDeleted={viewingDeleted}
      canDelete={canDelete}
      onRequestBulkDelete={onRequestBulkDelete}
      onRequestBulkRestore={onRequestBulkRestore}
      onClearSelection={onClearSelection}
      bulkActions={bulkActions}
      leadingIcon={CheckSquare}
      i18nNamespace="tasks"
    />
  );
}
