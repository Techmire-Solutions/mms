import type { ReactElement } from "react";
import { BookOpenText } from "lucide-react";
import { ACCOUNTING_MODULE_MANIFEST } from "@mms/shared";
import { ModuleUniversalBulkActionBar } from "@/components/ui/ModuleUniversalBulkActionBar";

export interface AccountingBulkActionBarProps {
  selectedCount: number;
  showDeleted: boolean;
  canDelete: boolean;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onClearSelection: () => void;
  bulkActions?: readonly string[];
}

/** Accounting Journal Work bulk bar — thin adapter delegating to shared ModuleUniversalBulkActionBar. */
export function AccountingBulkActionBar({
  selectedCount,
  showDeleted,
  canDelete,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onClearSelection,
  bulkActions = ACCOUNTING_MODULE_MANIFEST.work.bulkActions,
}: AccountingBulkActionBarProps): ReactElement {
  return (
    <ModuleUniversalBulkActionBar
      selectedCount={selectedCount}
      viewingDeleted={showDeleted}
      canDelete={canDelete}
      onRequestBulkDelete={onRequestBulkDelete}
      onRequestBulkRestore={onRequestBulkRestore}
      onClearSelection={onClearSelection}
      bulkActions={bulkActions}
      leadingIcon={BookOpenText}
      i18nNamespace="accounting"
    />
  );
}
