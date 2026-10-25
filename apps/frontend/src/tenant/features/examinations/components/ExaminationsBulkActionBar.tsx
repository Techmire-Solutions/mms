import React from "react";
import { BookOpen } from "lucide-react";
import { EXAMINATIONS_MODULE_MANIFEST } from "@mms/shared";
import { BulkSelectionBar } from "@/components/app/BulkSelectionBar";

export interface ExaminationsBulkActionBarProps {
  selectedCount: number;
  showDeleted: boolean;
  canDelete: boolean;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onClearSelection: () => void;
  bulkActions?: readonly string[];
}

/** Examinations Work bulk bar — thin adapter delegating to shared BulkSelectionBar. */
export function ExaminationsBulkActionBar({
  selectedCount,
  showDeleted,
  canDelete,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onClearSelection,
  bulkActions = EXAMINATIONS_MODULE_MANIFEST.work.bulkActions,
}: ExaminationsBulkActionBarProps): React.JSX.Element {
  return (
    <BulkSelectionBar
      selectedCount={selectedCount}
      viewingDeleted={showDeleted}
      canDelete={canDelete}
      onRequestBulkDelete={onRequestBulkDelete}
      onRequestBulkRestore={onRequestBulkRestore}
      onClearSelection={onClearSelection}
      bulkActions={bulkActions}
      leadingIcon={BookOpen}
      i18nNamespace="examinations"
    />
  );
}
