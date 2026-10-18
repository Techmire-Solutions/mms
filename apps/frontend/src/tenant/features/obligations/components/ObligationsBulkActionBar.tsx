import type { ReactElement } from "react";
import { Receipt } from "lucide-react";
import { OBLIGATIONS_MODULE_MANIFEST } from "@mms/shared";
import { ModuleUniversalBulkActionBar } from "@/components/app/ModuleUniversalBulkActionBar";

export interface ObligationsBulkActionBarProps {
  selectedCount: number;
  showDeleted: boolean;
  canDelete: boolean;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onClearSelection: () => void;
  bulkActions?: readonly string[];
}

/** Obligations Work bulk bar — thin adapter delegating to shared ModuleUniversalBulkActionBar. */
export function ObligationsBulkActionBar({
  selectedCount,
  showDeleted,
  canDelete,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onClearSelection,
  bulkActions = OBLIGATIONS_MODULE_MANIFEST.work.bulkActions,
}: ObligationsBulkActionBarProps): ReactElement {
  return (
    <ModuleUniversalBulkActionBar
      selectedCount={selectedCount}
      viewingDeleted={showDeleted}
      canDelete={canDelete}
      onRequestBulkDelete={onRequestBulkDelete}
      onRequestBulkRestore={onRequestBulkRestore}
      onClearSelection={onClearSelection}
      bulkActions={bulkActions}
      leadingIcon={Receipt}
      i18nNamespace="obligations"
    />
  );
}
