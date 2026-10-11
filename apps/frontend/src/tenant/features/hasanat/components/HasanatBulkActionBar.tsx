import type { ReactElement } from "react";
import { HandCoins } from "lucide-react";
import { HASANAT_MODULE_MANIFEST } from "@mms/shared";
import { ModuleUniversalBulkActionBar } from "@/components/ui/ModuleUniversalBulkActionBar";

export interface HasanatBulkActionBarProps {
  selectedCount: number;
  showDeleted: boolean;
  canDelete: boolean;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onClearSelection: () => void;
  bulkActions?: readonly string[];
}

/** Hasanat Work bulk bar — thin adapter delegating to shared ModuleUniversalBulkActionBar. */
export function HasanatBulkActionBar({
  selectedCount,
  showDeleted,
  canDelete,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onClearSelection,
  bulkActions = HASANAT_MODULE_MANIFEST.work.bulkActions,
}: HasanatBulkActionBarProps): ReactElement {
  return (
    <ModuleUniversalBulkActionBar
      selectedCount={selectedCount}
      viewingDeleted={showDeleted}
      canDelete={canDelete}
      onRequestBulkDelete={onRequestBulkDelete}
      onRequestBulkRestore={onRequestBulkRestore}
      onClearSelection={onClearSelection}
      bulkActions={bulkActions}
      leadingIcon={HandCoins}
      i18nNamespace="hasanat"
    />
  );
}
