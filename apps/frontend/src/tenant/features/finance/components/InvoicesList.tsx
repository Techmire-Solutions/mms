import React, { useState } from "react";
import type { ModuleColumnCustomizerProps } from "@/components/ui/ModuleColumnCustomizer";
import { InvoicesListOverlays } from "@/tenant/features/finance/components/InvoicesListOverlays";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import type { Invoice } from "@/lib/data/financeData";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";
import { FinanceBulkActionBar } from "@/tenant/features/finance/components/FinanceBulkActionBar";
import { InvoicesListContent } from "@/tenant/features/finance/components/InvoicesListContent";
import { InvoicesListFilters } from "@/tenant/features/finance/components/InvoicesListFilters";
import { getInvoiceVisibleWorkColumns } from "@/tenant/features/finance/components/invoiceListVisibleColumns";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";

const ALWAYS_COLUMN_VISIBLE = (_key: string): boolean => true;

export interface InvoicesListProps {
  invoices: Invoice[];
  onView: (invoice: Invoice) => void;
  onRecord: (invoice: Invoice) => void;
  canWrite?: boolean;
  canDelete?: boolean;
  canWriteMessaging?: boolean;
  showDeleted?: boolean;
  onToggleDeleted?: () => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkRestore?: (ids: string[]) => void;
  onBulkStatusChange?: (ids: string[], status: string) => void;
  onBulkPrintReceipts?: (invoices: Invoice[]) => void;
  isBulkStatusPending?: boolean;
  selectedIds?: string[];
  onToggleSelectedInvoice?: (id: string, checked: boolean) => void;
  onToggleSelectAll?: (checked: boolean, visibleIds: string[]) => void;
  onClearSelection?: () => void;
  isColumnVisible?: (key: string) => boolean;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
  filterStatus?: string[];
  onFilterStatusChange?: React.Dispatch<React.SetStateAction<string[]>>;
}

export function InvoicesList({
  invoices,
  onView,
  onRecord,
  canWrite = true,
  canDelete = false,
  canWriteMessaging = false,
  showDeleted = false,
  onToggleDeleted,
  onDelete,
  onRestore,
  onBulkDelete,
  onBulkRestore,
  onBulkStatusChange,
  onBulkPrintReceipts,
  isBulkStatusPending = false,
  selectedIds = [],
  onToggleSelectedInvoice,
  onToggleSelectAll,
  onClearSelection,
  isColumnVisible,
  getColumnWidth,
  onColumnResize,
  columnCustomizer,
  filterStatus: controlledFilterStatus,
  onFilterStatusChange,
}: InvoicesListProps): React.JSX.Element {
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const { formatCurrency } = useFinanceCurrency();
  const { messagingTarget, openComposer, closeComposer } = useMessageComposerState();
  const [search, setSearch] = useState("");
  const [localFilterStatus, setLocalFilterStatus] = useState<string[]>([]);
  const filterStatus = controlledFilterStatus ?? localFilterStatus;
  const setFilterStatus = onFilterStatusChange ?? setLocalFilterStatus;
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);

  const columnVisible = isColumnVisible ?? ALWAYS_COLUMN_VISIBLE;
  const columnRegistry = columnCustomizer?.columnRegistry ?? [];

  const normalizedSearch = search.toLowerCase();
  const filtered = invoices.filter((invoice) => {
    const matchSearch =
      !normalizedSearch ||
      invoice.studentName.toLowerCase().includes(normalizedSearch) ||
      invoice.id.toLowerCase().includes(normalizedSearch) ||
      invoice.session.toLowerCase().includes(normalizedSearch);
    const matchStatus = filterStatus.length === 0 || filterStatus.includes(invoice.status);
    return matchSearch && matchStatus;
  });

  const selectedSet = new Set(selectedIds);
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((inv) => selectedSet.has(inv.id));
  const someVisibleSelected =
    selectedSet.size > 0 && filtered.some((inv) => selectedSet.has(inv.id));

  const statusConfig = (() => ({
    paid: { label: t("finance.invoiceStatus.paid"), cls: SEMANTIC_BADGE.success },
    pending: { label: t("finance.invoiceStatus.pending"), cls: SEMANTIC_BADGE.warning },
    overdue: { label: t("finance.invoiceStatus.overdue"), cls: SEMANTIC_BADGE.destructive },
    partial: { label: t("finance.invoiceStatus.partial"), cls: SEMANTIC_BADGE.info },
    cancelled: { label: t("finance.invoiceStatus.cancelled"), cls: SEMANTIC_BADGE.muted },
  }))() as Record<string, StatusBadgeConfigItem>;

  const visibleColCount =
    getInvoiceVisibleWorkColumns(columnRegistry, columnVisible).length + (canDelete ? 1 : 0) + 1;

  const toggleStatus = (status: string) =>
    setFilterStatus((currentStatuses) =>
      currentStatuses.includes(status)
        ? currentStatuses.filter((selectedStatus) => selectedStatus !== status)
        : [...currentStatuses, status],
    );

  return (
    <section aria-label={t("finance.invoices")} className="space-y-4">
      <InvoicesListFilters
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={search}
        filterStatus={filterStatus}
        canDelete={canDelete}
        showDeleted={showDeleted}
        onToggleDeleted={onToggleDeleted}
        columnCustomizer={columnCustomizer}
        onSearchChange={setSearch}
        onToggleStatus={toggleStatus}
        onClearStatuses={() => setFilterStatus([])}
      />

      {canDelete && (
        <FinanceBulkActionBar
          selectedCount={selectedIds.length}
          showDeleted={showDeleted}
          canDelete={canDelete}
          onRequestBulkDelete={() => setConfirmBulkOpen(true)}
          onRequestBulkRestore={() => setConfirmBulkOpen(true)}
          onClearSelection={onClearSelection ?? (() => {})}
          onBulkStatusChange={
            onBulkStatusChange ? (status) => onBulkStatusChange(selectedIds, status) : undefined
          }
          onBulkPrintReceipts={
            onBulkPrintReceipts
              ? () => {
                  const selSet = new Set(selectedIds);
                  return onBulkPrintReceipts(filtered.filter((inv) => selSet.has(inv.id)));
                }
              : undefined
          }
          isBulkStatusPending={isBulkStatusPending}
          statusBadgeConfig={statusConfig}
        />
      )}

      <InvoicesListContent
        viewMode={viewMode}
        invoices={filtered}
        selectedIds={selectedIds}
        isColumnVisible={columnVisible}
        visibleColCount={visibleColCount}
        columnRegistry={columnRegistry}
        canSelectInvoices={canDelete}
        allVisibleSelected={allVisibleSelected}
        someVisibleSelected={someVisibleSelected}
        canWrite={canWrite}
        canDelete={canDelete}
        canWriteMessaging={canWriteMessaging}
        showDeleted={showDeleted}
        statusConfig={statusConfig}
        formatCurrency={formatCurrency}
        getColumnWidth={getColumnWidth}
        onColumnResize={onColumnResize}
        onToggleSelectAll={(checked) =>
          onToggleSelectAll?.(
            checked,
            filtered.map((inv) => inv.id),
          )
        }
        onToggleSelectedInvoice={(id, checked) => onToggleSelectedInvoice?.(id, checked)}
        onView={onView}
        onRecord={onRecord}
        onRequestDelete={onDelete ? setPendingDeleteId : undefined}
        onRestore={onRestore}
        openComposer={openComposer}
      />

      <InvoicesListOverlays
        messagingTarget={messagingTarget}
        closeComposer={closeComposer}
        pendingDeleteId={pendingDeleteId}
        onPendingDeleteIdChange={setPendingDeleteId}
        confirmBulkOpen={confirmBulkOpen}
        onConfirmBulkOpenChange={setConfirmBulkOpen}
        showDeleted={showDeleted}
        selectedIds={selectedIds}
        onDelete={onDelete}
        onBulkDelete={onBulkDelete}
        onBulkRestore={onBulkRestore}
        onClearSelection={onClearSelection}
        t={t}
      />
    </section>
  );
}
