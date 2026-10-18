import React from "react";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work";
import { MODULE_ROW_ACTIONS_TRIGGER_CLASS } from "@/components/app/ModuleRowActionsMenu";
import { useTranslation } from "@/hooks/useTranslation";
import { InvoicesRowActions } from "@/tenant/features/finance/components/InvoicesRowActions";
import { renderInvoiceWorkColumnValue } from "@/tenant/features/finance/components/invoiceWorkColumnCell";
import type { InvoicesListContentProps } from "@/tenant/features/finance/lib/invoicesListShared";
import type { Invoice } from "@/lib/data/financeData";

export type InvoicesListDesktopTableProps = InvoicesListContentProps;

export function InvoicesListDesktopTable(props: InvoicesListDesktopTableProps): React.JSX.Element {
  const {
    invoices,
    selectedIds,
    isColumnVisible,
    canSelectInvoices,
    allVisibleSelected,
    someVisibleSelected,
    canWrite,
    canDelete,
    canWriteMessaging,
    showDeleted,
    statusConfig,
    formatCurrency,
    getColumnWidth,
    onColumnResize,
    onView,
    onRecord,
    onRequestDelete,
    onRestore,
    onToggleSelectAll,
    onToggleSelectedInvoice,
    openComposer,
  } = props;
  const { t } = useTranslation();
  const selectedIdsSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const columnContext = React.useMemo(
    () => ({ t, statusConfig, formatCurrency }),
    [t, statusConfig, formatCurrency],
  );

  const columns = React.useMemo<WorkBatchTableColumn<Invoice>[]>(() => {
    const cols: WorkBatchTableColumn<Invoice>[] = [];

    if (isColumnVisible("invoice")) {
      cols.push({
        id: "invoice",
        label: t("finance.columns.invoice"),
        render: (invoice: Invoice) =>
          renderInvoiceWorkColumnValue(invoice, "invoice", columnContext),
      });
    }

    if (isColumnVisible("student")) {
      cols.push({
        id: "student",
        label: t("finance.columns.student"),
        render: (invoice: Invoice) =>
          renderInvoiceWorkColumnValue(invoice, "student", columnContext),
      });
    }

    if (isColumnVisible("sessionClass")) {
      cols.push({
        id: "sessionClass",
        label: t("finance.columns.sessionClass"),
        render: (invoice: Invoice) =>
          renderInvoiceWorkColumnValue(invoice, "sessionClass", columnContext),
      });
    }

    if (isColumnVisible("baseFee")) {
      cols.push({
        id: "baseFee",
        label: t("finance.columns.baseFee"),
        noWrap: true,
        render: (invoice: Invoice) =>
          renderInvoiceWorkColumnValue(invoice, "baseFee", columnContext),
      });
    }

    if (isColumnVisible("discount")) {
      cols.push({
        id: "discount",
        label: t("finance.columns.discount"),
        noWrap: true,
        render: (invoice: Invoice) =>
          renderInvoiceWorkColumnValue(invoice, "discount", columnContext),
      });
    }

    if (isColumnVisible("final")) {
      cols.push({
        id: "final",
        label: t("finance.columns.final"),
        noWrap: true,
        render: (invoice: Invoice) => renderInvoiceWorkColumnValue(invoice, "final", columnContext),
      });
    }

    if (isColumnVisible("status")) {
      cols.push({
        id: "status",
        label: t("finance.columns.status"),
        noWrap: true,
        render: (invoice: Invoice) =>
          renderInvoiceWorkColumnValue(invoice, "status", columnContext),
      });
    }

    if (isColumnVisible("dueDate")) {
      cols.push({
        id: "dueDate",
        label: t("finance.columns.dueDate"),
        noWrap: true,
        render: (invoice: Invoice) =>
          renderInvoiceWorkColumnValue(invoice, "dueDate", columnContext),
      });
    }

    return cols;
  }, [columnContext, isColumnVisible, t]);

  return (
    <WorkBatchTable
      data={invoices}
      columns={columns}
      caption={t("finance.invoices")}
      selection={
        canSelectInvoices
          ? {
              selectedIds,
              onSelectOne: (id) => onToggleSelectedInvoice(id, !selectedIdsSet.has(id)),
              onSelectAll: () => onToggleSelectAll(!allVisibleSelected),
              allSelected: allVisibleSelected,
              someSelected: someVisibleSelected,
              selectAllAriaLabel: t("finance.table.selectAll"),
              selectRowAriaLabel: (invoice) => t("finance.table.selectInvoice", { id: invoice.id }),
            }
          : undefined
      }
      columnResize={{
        getColumnWidth,
        onColumnResize,
      }}
      renderRowActions={(invoice) => (
        <InvoicesRowActions
          invoice={invoice}
          canWrite={canWrite}
          canDelete={canDelete}
          canWriteMessaging={canWriteMessaging}
          showDeleted={showDeleted}
          triggerClassName={MODULE_ROW_ACTIONS_TRIGGER_CLASS}
          onView={onView}
          onRecord={onRecord}
          onRequestDelete={onRequestDelete}
          onRestore={onRestore}
          openComposer={openComposer}
        />
      )}
      actionsLabel={t("common.actions")}
    />
  );
}
