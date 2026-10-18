import React from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { formatDate } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work";
import type { Payment } from "@/lib/data/financeData";

export interface PaymentsListDesktopTableProps {
  payments: Payment[];
  selectedIds: string[];
  isColumnVisible: (key: string) => boolean;
  visibleColCount: number;
  allSelected: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  methodConfig: Record<string, StatusBadgeConfigItem>;
  formatCurrency: (amount: number) => string;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  onTogglePayment: (paymentId: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onRequestDelete: (paymentId: string) => void;
  onRestore?: (paymentId: string) => void;
}

export function PaymentsListDesktopTable({
  payments,
  selectedIds,
  isColumnVisible,
  visibleColCount: _visibleColCount,
  allSelected,
  canDelete,
  showDeleted,
  methodConfig,
  formatCurrency,
  getColumnWidth,
  onColumnResize,
  onTogglePayment,
  onToggleAll,
  onRequestDelete,
  onRestore,
}: PaymentsListDesktopTableProps): React.JSX.Element {
  const { t } = useTranslation();
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  const columns = React.useMemo<WorkBatchTableColumn<Payment>[]>(() => {
    const cols: WorkBatchTableColumn<Payment>[] = [];

    if (isColumnVisible("date")) {
      cols.push({
        id: "date",
        label: t("finance.columns.paymentDate"),
        noWrap: true,
        cellClassName: "text-muted-foreground",
        render: (payment: Payment) => formatDate(payment.date),
      });
    }

    if (isColumnVisible("student")) {
      cols.push({
        id: "student",
        label: t("finance.columns.student"),
        noWrap: true,
        cellClassName: "font-semibold text-foreground",
        render: (payment: Payment) => payment.studentName,
      });
    }

    if (isColumnVisible("invoice")) {
      cols.push({
        id: "invoice",
        label: t("finance.columns.invoice"),
        noWrap: true,
        cellClassName: "font-mono text-xs text-muted-foreground",
        render: (payment: Payment) => payment.invoiceId,
      });
    }

    if (isColumnVisible("amount")) {
      cols.push({
        id: "amount",
        label: t("finance.columns.amount"),
        noWrap: true,
        cellClassName: "font-bold text-success",
        render: (payment: Payment) => formatCurrency(payment.amount),
      });
    }

    if (isColumnVisible("method")) {
      cols.push({
        id: "method",
        label: t("finance.columns.method"),
        noWrap: true,
        render: (payment: Payment) => (
          <StatusBadge status={payment.method} config={methodConfig} size="sm" />
        ),
      });
    }

    if (isColumnVisible("receivedBy")) {
      cols.push({
        id: "receivedBy",
        label: t("finance.columns.receivedBy"),
        cellClassName: "text-muted-foreground",
        render: (payment: Payment) => payment.receivedBy || "—",
      });
    }

    if (isColumnVisible("note")) {
      cols.push({
        id: "note",
        label: t("finance.columns.note"),
        truncate: true,
        cellClassName: "max-w-cell-sm text-muted-foreground",
        render: (payment: Payment) => payment.note || "—",
      });
    }

    return cols;
  }, [formatCurrency, isColumnVisible, methodConfig, t]);

  const renderRowAction = (payment: Payment) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => (showDeleted ? onRestore?.(payment.id) : onRequestDelete(payment.id))}
      aria-label={showDeleted ? t("finance.trash.restore") : t("common.delete")}
    >
      {showDeleted ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );

  return (
    <WorkBatchTable
      data={payments}
      columns={columns}
      caption={t("finance.paymentLog")}
      selection={
        canDelete
          ? {
              selectedIds,
              onSelectOne: (id) => onTogglePayment(id, !selectedSet.has(id)),
              onSelectAll: () => onToggleAll(!allSelected),
              allSelected,
              someSelected: selectedIds.length > 0 && !allSelected,
              selectAllAriaLabel: t("finance.trash.selectAll"),
              selectRowAriaLabel: (payment) => t("finance.trash.selectPayment", { id: payment.id }),
            }
          : undefined
      }
      columnResize={{
        getColumnWidth,
        onColumnResize,
      }}
      renderRowActions={canDelete ? renderRowAction : undefined}
      actionsLabel={canDelete ? t("common.actions") : undefined}
      emptyState={<EmptyState title={t("finance.empty.payments")} compact />}
    />
  );
}
