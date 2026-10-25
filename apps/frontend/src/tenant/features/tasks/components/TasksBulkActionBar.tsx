/**
 * @file TasksBulkActionBar.tsx
 * @description Bulk archive/restore chrome for Tasks Work selection.
 */

import React from "react";
import { CheckSquare } from "lucide-react";
import { TASKS_MODULE_MANIFEST } from "@mms/shared";
import { BulkSelectionBar } from "@/components/app/BulkSelectionBar";
import { useTaskStatusConfig } from "./TaskBadges";

export interface TasksBulkActionBarProps {
  selectedCount: number;
  viewingDeleted: boolean;
  canWrite?: boolean;
  canDelete: boolean;
  onClearSelection: () => void;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onBulkStatusChange?: (status: string) => void;
  statusPending?: boolean;
  bulkActions?: readonly string[];
}

/** Tasks Work bulk bar — thin adapter delegating to shared BulkSelectionBar. */
export function TasksBulkActionBar({
  selectedCount,
  viewingDeleted,
  canWrite = true,
  canDelete,
  onClearSelection,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onBulkStatusChange,
  statusPending = false,
  bulkActions,
}: TasksBulkActionBarProps): React.JSX.Element | null {
  const taskStatusConfig = useTaskStatusConfig();
  const effectiveBulkActions =
    bulkActions ??
    (onBulkStatusChange && canWrite
      ? (["delete", "status"] as const)
      : TASKS_MODULE_MANIFEST.work.bulkActions);

  return (
    <BulkSelectionBar
      selectedCount={selectedCount}
      viewingDeleted={viewingDeleted}
      canWrite={canWrite}
      canDelete={canDelete}
      onRequestBulkDelete={onRequestBulkDelete}
      onRequestBulkRestore={onRequestBulkRestore}
      onClearSelection={onClearSelection}
      statusConfig={taskStatusConfig}
      onBulkStatusChange={onBulkStatusChange}
      statusPending={statusPending}
      bulkActions={effectiveBulkActions}
      leadingIcon={CheckSquare}
      i18nNamespace="tasks"
    />
  );
}
