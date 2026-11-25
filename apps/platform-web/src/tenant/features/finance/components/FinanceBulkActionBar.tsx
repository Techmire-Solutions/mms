import React from "react";
import { Printer, ReceiptText } from "lucide-react";
import { FINANCE_MODULE_MANIFEST } from "@mms/contracts";
import type { StatusBadgeConfigItem } from "@mms/fe-core/components/StatusBadge";
import { BulkSelectionBar } from "@mms/fe-core/components/BulkSelectionBar";
import { bulkActionDockActionClassName } from "@mms/ui/app/bulkActionDockStyles";
import { Button } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";

export interface FinanceBulkActionBarProps {
  selectedCount: number;
  showDeleted: boolean;
  canDelete: boolean;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onClearSelection: () => void;
  onBulkStatusChange?: (status: string) => void;
  onBulkPrintReceipts?: () => void;
  isBulkStatusPending?: boolean;
  statusBadgeConfig?: Record<string, StatusBadgeConfigItem>;
  bulkActions?: readonly string[];
}

/** Finance invoices Work bulk bar — delegates to shared BulkSelectionBar. */
export function FinanceBulkActionBar({
  selectedCount,
  showDeleted,
  canDelete,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onClearSelection,
  onBulkStatusChange,
  onBulkPrintReceipts,
  isBulkStatusPending = false,
  statusBadgeConfig = {},
  bulkActions = FINANCE_MODULE_MANIFEST.work.bulkActions,
}: FinanceBulkActionBarProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <BulkSelectionBar
      selectedCount={selectedCount}
      viewingDeleted={showDeleted}
      canDelete={canDelete}
      leadingIcon={ReceiptText}
      i18nNamespace="finance"
      bulkActions={bulkActions}
      onClearSelection={onClearSelection}
      onRequestBulkDelete={onRequestBulkDelete}
      onRequestBulkRestore={onRequestBulkRestore}
      statusConfig={statusBadgeConfig}
      onBulkStatusChange={onBulkStatusChange}
      statusPending={isBulkStatusPending}
      extraActions={
        !showDeleted && bulkActions.includes("receipts") && onBulkPrintReceipts ? (
          <Button
            type="button"
            variant="outline"
            onClick={onBulkPrintReceipts}
            className={bulkActionDockActionClassName}
          >
            <Printer className="w-3.5 h-3.5" aria-hidden /> {t("finance.printReceipts")}
          </Button>
        ) : undefined
      }
    />
  );
}
