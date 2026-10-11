import { JournalEntriesList } from "@/tenant/features/accounting/components/JournalEntriesList";
import {
  JournalEntriesListFilters,
  JournalEntriesAdvancedFilters,
} from "@/tenant/features/accounting/components/JournalEntriesListFilters";
import { AccountingBulkActionBar } from "@/tenant/features/accounting/components/AccountingBulkActionBar";
import { JournalEntriesModalLayer } from "@/tenant/features/accounting/components/JournalEntriesModalLayer";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type {
  JournalMode,
  JournalEntriesAdvancedModeProps,
} from "./journalEntriesAdvancedModeTypes";

export type { JournalMode, JournalEntriesAdvancedModeProps };

export function JournalEntriesAdvancedMode(props: JournalEntriesAdvancedModeProps) {
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();

  return (
    <section aria-label={t("accounting.journal.advancedAria")} className="space-y-4">
      <JournalEntriesListFilters
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        mode={props.mode}
        modeTabs={props.modeTabs}
        search={props.search}
        statusFilter={props.statusFilter}
        tagFilter={props.tagFilter}
        showFilters={props.showFilters}
        canWrite={props.canWrite}
        canDelete={props.canDelete}
        showDeleted={props.showDeleted}
        onToggleDeleted={props.onToggleDeleted}
        columnCustomizer={props.columnCustomizer}
        onModeChange={props.onModeChange}
        onSearchChange={props.onSearchChange}
        onStatusFilterChange={props.onStatusFilterChange}
        onTagFilterChange={props.onTagFilterChange}
        onShowFiltersChange={props.onShowFiltersChange}
        onOpenNew={props.onOpenNew}
        onExportCsv={props.onExportCsv}
      />

      {props.canDelete && (
        <AccountingBulkActionBar
          selectedCount={props.selectedIds.length}
          showDeleted={props.showDeleted}
          canDelete={props.canDelete}
          onRequestBulkDelete={() => props.onRequestBulkTrash()}
          onRequestBulkRestore={() => props.onRequestBulkTrash()}
          onClearSelection={props.onClearSelection}
        />
      )}

      {props.showFilters && (
        <JournalEntriesAdvancedFilters
          dateFrom={props.dateFrom}
          dateTo={props.dateTo}
          onDateFromChange={props.onDateFromChange}
          onDateToChange={props.onDateToChange}
          onClear={() => {
            props.onDateFromChange("");
            props.onDateToChange("");
          }}
        />
      )}

      <p className="m-0 text-xs text-muted-foreground" role="status">
        {props.pageScopeLabel}
      </p>

      <JournalEntriesList
        viewMode={viewMode}
        entries={props.filteredEntries}
        selectedIds={props.selectedIds}
        canDelete={props.canDelete}
        allVisibleSelected={props.allVisibleSelected}
        someVisibleSelected={props.someVisibleSelected}
        isColumnVisible={props.isColumnVisible}
        journalStatusConfig={props.journalStatusConfig}
        grandDebit={props.grandDebit}
        grandCredit={props.grandCredit}
        formatAmount={props.formatAmount}
        renderEntryActions={props.renderEntryActions}
        renderEntryActionsCards={props.renderEntryActionsCards}
        onView={props.onViewEntry}
        onToggleSelectedEntry={props.onToggleSelectedEntry}
        onToggleSelectAll={props.onToggleSelectAll}
        getColumnWidth={props.getColumnWidth}
        onColumnResize={props.onColumnResize}
        showDeleted={props.showDeleted}
        hasActiveFilters={
          props.search.trim().length > 0 ||
          props.statusFilter !== "all" ||
          props.tagFilter !== "all" ||
          Boolean(props.dateFrom || props.dateTo)
        }
        onClearFilters={() => {
          props.onSearchChange("");
          props.onStatusFilterChange("all");
          props.onTagFilterChange("all");
          props.onDateFromChange("");
          props.onDateToChange("");
        }}
        onShowActive={props.onToggleDeleted}
        onCreate={props.onOpenNew}
        canWrite={props.canWrite}
        {...props.paging}
      />

      <JournalEntriesModalLayer
        modal={props.modal}
        canWrite={props.canWrite}
        canDelete={props.canDelete}
        selected={props.selected}
        accounts={props.accounts}
        allEntries={props.allEntries}
        entries={props.entries}
        fiscalYears={props.fiscalYears}
        onSave={props.onSave}
        onAccountsChange={props.onAccountsChange}
        onCloseModal={props.onCloseModal}
        onEditSelected={props.onEditSelected}
        onRequestReverse={props.onRequestReverse}
        onRestoreEntry={props.onRestoreEntry}
        pendingTrashId={props.pendingTrashId}
        onPendingTrashIdChange={props.onPendingTrashIdChange}
        confirmBulkOpen={props.confirmBulkOpen}
        onConfirmBulkOpenChange={props.onConfirmBulkOpenChange}
        showDeleted={props.showDeleted}
        selectedIds={props.selectedIds}
        onConfirmRowTrash={props.onConfirmRowTrash}
        onConfirmBulkTrash={props.onConfirmBulkTrash}
        pendingReverseEntry={props.pendingReverseEntry}
        onPendingReverseEntryChange={props.onPendingReverseEntryChange}
        onConfirmReverse={props.onConfirmReverse}
        t={t}
      />
    </section>
  );
}
