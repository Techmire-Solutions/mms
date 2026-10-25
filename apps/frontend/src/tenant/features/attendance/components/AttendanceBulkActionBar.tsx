import React from "react";
import { UserCheck } from "lucide-react";
import { ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import { BulkSelectionBar } from "@/components/app/BulkSelectionBar";

export interface AttendanceBulkActionBarProps {
  selectedCount: number;
  showDeleted: boolean;
  canDelete: boolean;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onClearSelection: () => void;
  bulkActions?: readonly string[];
}

/** Attendance Work bulk bar — thin adapter delegating to shared BulkSelectionBar. */
export function AttendanceBulkActionBar({
  selectedCount,
  showDeleted,
  canDelete,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onClearSelection,
  bulkActions = ATTENDANCE_MODULE_MANIFEST.work.bulkActions,
}: AttendanceBulkActionBarProps): React.JSX.Element {
  return (
    <BulkSelectionBar
      selectedCount={selectedCount}
      viewingDeleted={showDeleted}
      canDelete={canDelete}
      onRequestBulkDelete={onRequestBulkDelete}
      onRequestBulkRestore={onRequestBulkRestore}
      onClearSelection={onClearSelection}
      bulkActions={bulkActions}
      leadingIcon={UserCheck}
      i18nNamespace="attendance"
    />
  );
}
