import type React from "react";
import { DirectoryCard } from "@/components/app/DirectoryCard";
import { EntityCardsGrid } from "@/components/app/EntityCardsGrid";
import { ENTITY_CARD_OVERFLOW_TRIGGER_CLASS } from "@/components/app/entityCardChrome";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { InvoicesRowActions } from "@/tenant/features/finance/components/InvoicesRowActions";
import { getInvoiceVisibleWorkColumns } from "@/tenant/features/finance/lib/invoiceListVisibleColumns";
import { renderInvoiceWorkColumnValue } from "@/tenant/features/finance/components/invoiceWorkColumnCell";
import type { InvoicesListContentProps } from "@/tenant/features/finance/lib/invoicesListShared";

export type InvoicesListCardsProps = Omit<
  InvoicesListContentProps,
  "visibleColCount" | "getColumnWidth" | "onColumnResize"
>;

const getInvoiceAccentClass = (status: string): string => {
  if (status === "paid") return "bg-success/60 group-hover:bg-success";
  if (status === "overdue") return "bg-destructive/60 group-hover:bg-destructive";
  if (status === "partially_paid") return "bg-warning/60 group-hover:bg-warning";
  return "bg-primary/50 group-hover:bg-primary";
};

/** Work directory card — DirectoryCard SSOT (do not hand-compose EntityCard). */
function InvoiceCard({
  invoice,
  props,
  reducedMotion,
}: {
  invoice: InvoicesListCardsProps["invoices"][number];
  props: InvoicesListCardsProps;
  reducedMotion: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const {
    isColumnVisible,
    columnRegistry,
    canSelectInvoices,
    selectedIds,
    canWrite,
    canDelete,
    canWriteMessaging,
    showDeleted,
    statusConfig,
    formatCurrency,
    onView,
    onRecord,
    onRequestDelete,
    onRestore,
    onToggleSelectedInvoice,
    openComposer,
  } = props;

  const visibleColumns = getInvoiceVisibleWorkColumns(columnRegistry, isColumnVisible, {
    excludeFace: true,
  });

  return (
    <DirectoryCard
      entity={invoice}
      selectedIds={selectedIds}
      canSelect={canSelectInvoices}
      onToggleSelected={onToggleSelectedInvoice}
      onView={onView}
      reducedMotion={reducedMotion}
      accentClassName={getInvoiceAccentClass(invoice.status)}
      header={{
        displayName: invoice.studentName,
        subtitle: <p className="font-mono text-xs text-muted-foreground truncate">{invoice.id}</p>,
      }}
      viewLabel={t("finance.table.viewProfile")}
      viewAriaLabel={`${t("finance.table.viewProfile")} - ${invoice.studentName}`}
      columns={visibleColumns}
      keyFor={(col) => col.key}
      labelFor={(col) => col.label}
      renderValue={(col) =>
        renderInvoiceWorkColumnValue(invoice, col.key, {
          t,
          statusConfig,
          formatCurrency,
          emptyFallback: null,
        })
      }
      overflowActions={
        <InvoicesRowActions
          invoice={invoice}
          canWrite={canWrite}
          canDelete={canDelete}
          canWriteMessaging={canWriteMessaging}
          showDeleted={showDeleted}
          hideViewItem
          triggerClassName={ENTITY_CARD_OVERFLOW_TRIGGER_CLASS}
          onView={onView}
          onRecord={onRecord}
          onRequestDelete={onRequestDelete}
          onRestore={onRestore}
          openComposer={openComposer}
        />
      }
    />
  );
}

export function InvoicesListCards(props: InvoicesListCardsProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const {
    invoices,
    selectedIds,
    canSelectInvoices,
    allVisibleSelected,
    someVisibleSelected,
    onToggleSelectAll,
  } = props;

  const pageCountLabel = formatDirectoryPageCountLabel(invoices.length, t, {
    singular: "finance.item.invoice",
    plural: "finance.item.invoices",
  });

  return (
    <EntityCardsGrid
      items={invoices}
      selectedIds={selectedIds}
      onSelectAll={canSelectInvoices ? () => onToggleSelectAll(!allVisibleSelected) : undefined}
      allSelected={allVisibleSelected}
      someSelected={someVisibleSelected}
      selectAllLabel={t("finance.table.selectAll")}
      deselectAllLabel={t("common.deselect")}
      selectedCountLabel={t("finance.trash.selected", { count: selectedIds.length })}
      checkboxIdPrefix="finance-invoices"
      renderItem={(invoice) => (
        <InvoiceCard
          key={invoice.id}
          invoice={invoice}
          props={props}
          reducedMotion={reducedMotion}
        />
      )}
    />
  );
}
