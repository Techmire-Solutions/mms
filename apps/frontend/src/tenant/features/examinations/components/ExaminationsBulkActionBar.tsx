import React from "react";
import { BookOpen } from "lucide-react";
import { EXAMINATIONS_MODULE_MANIFEST } from "@mms/shared";
import { ModuleUniversalBulkActionBar } from "@/components/app/ModuleUniversalBulkActionBar";

export interface ExaminationsBulkActionBarProps {
  selectedCount: number;
  showDeleted: boolean;
  canDelete: boolean;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onClearSelection: () => void;
  bulkActions?: readonly string[];
}

/** Examinations Work bulk bar — thin adapter delegating to shared ModuleUniversalBulkActionBar. */
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
    <ModuleUniversalBulkActionBar
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
