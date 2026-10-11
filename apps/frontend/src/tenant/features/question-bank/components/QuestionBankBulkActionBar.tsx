import type { ReactElement } from "react";
import { ClipboardList } from "lucide-react";
import { QUESTION_BANK_MODULE_MANIFEST } from "@mms/shared";
import { ModuleUniversalBulkActionBar } from "@/components/ui/ModuleUniversalBulkActionBar";

export interface QuestionBankBulkActionBarProps {
  selectedCount: number;
  showDeleted: boolean;
  canDelete: boolean;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onClearSelection: () => void;
  bulkActions?: readonly string[];
}

/** Question Bank Work bulk bar — thin adapter delegating to shared ModuleUniversalBulkActionBar. */
export function QuestionBankBulkActionBar({
  selectedCount,
  showDeleted,
  canDelete,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onClearSelection,
  bulkActions = QUESTION_BANK_MODULE_MANIFEST.work.bulkActions,
}: QuestionBankBulkActionBarProps): ReactElement {
  return (
    <ModuleUniversalBulkActionBar
      selectedCount={selectedCount}
      viewingDeleted={showDeleted}
      canDelete={canDelete}
      onRequestBulkDelete={onRequestBulkDelete}
      onRequestBulkRestore={onRequestBulkRestore}
      onClearSelection={onClearSelection}
      bulkActions={bulkActions}
      leadingIcon={ClipboardList}
      i18nNamespace="questionBank"
    />
  );
}
