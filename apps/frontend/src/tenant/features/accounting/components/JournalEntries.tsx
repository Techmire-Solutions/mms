import { JournalEntriesAdvancedMode } from "@/tenant/features/accounting/components/JournalEntriesAdvancedMode";
import { JournalEntriesSimpleMode } from "@/tenant/features/accounting/components/JournalEntriesSimpleMode";
import type { JournalEntriesProps } from "@/tenant/features/accounting/components/journalEntriesTypes";
import type { JournalEntriesServerQueryProps } from "@/tenant/features/accounting/components/journalEntriesControllerFilters";
import { useJournalEntriesController } from "@/tenant/features/accounting/components/useJournalEntriesController";

export type { JournalEntriesProps } from "@/tenant/features/accounting/components/journalEntriesTypes";

/**
 * `journalEntriesTypes` keeps the directory-level contract; the server query
 * (filter values + pager) is added here by the accounting feature because the
 * controller only reads it through this component.
 */
export type JournalEntriesWithQueryProps = JournalEntriesProps & JournalEntriesServerQueryProps;

const ALWAYS_COLUMN_VISIBLE = (_key: string): boolean => true;

/**
 * JournalEntries Component
 *
 * Renders the main dashboard for accounting entries. Supports a simple mode
 * with quick actions and guided templates, as well as an advanced mode for double-entry bookkeeping.
 */
export function JournalEntries(props: JournalEntriesWithQueryProps) {
  const {
    entries,
    accounts,
    fiscalYears,
    isColumnVisible,
    getColumnWidth,
    onColumnResize,
    columnCustomizer,
  } = props;

  const controller = useJournalEntriesController(props);
  const columnVisible = isColumnVisible ?? ALWAYS_COLUMN_VISIBLE;

  if (controller.mode === "simple") {
    return (
      <JournalEntriesSimpleMode
        mode={controller.mode}
        tab={controller.tab}
        modeTabs={controller.modeTabs}
        journalSubTabs={controller.journalSubTabs}
        entries={entries}
        allEntries={props.allEntries}
        accounts={accounts}
        fiscalYears={fiscalYears}
        canWrite={controller.canWrite}
        simpleModal={controller.simpleModal}
        nlInput={controller.nlInput}
        nlSuggestion={controller.nlSuggestion}
        onModeChange={controller.setMode}
        onTabChange={controller.setTab}
        onNlSubmit={controller.handleNlSubmit}
        onNlChange={controller.handleNlChange}
        onOpenPrefill={(prefillType) => controller.setSimpleModal({ prefillType })}
        onExportCsv={controller.exportCSV}
        onSave={controller.handleSave}
        onAccountsChange={props.onAccountsChange}
        onCloseSimpleModal={() => controller.setSimpleModal(null)}
        pageScopeLabel={controller.pageScopeLabel}
      />
    );
  }

  return (
    <JournalEntriesAdvancedMode
      mode={controller.mode}
      modeTabs={controller.modeTabs}
      entries={entries}
      allEntries={props.allEntries}
      filteredEntries={controller.filtered}
      accounts={accounts}
      fiscalYears={fiscalYears}
      selectedIds={controller.selectedIds}
      allVisibleSelected={controller.allVisibleSelected}
      someVisibleSelected={controller.someVisibleSelected}
      isColumnVisible={columnVisible}
      journalStatusConfig={controller.journalStatusConfig}
      grandDebit={controller.grandDebit}
      grandCredit={controller.grandCredit}
      search={controller.search}
      statusFilter={controller.statusFilter}
      tagFilter={controller.tagFilter}
      dateFrom={controller.dateFrom}
      dateTo={controller.dateTo}
      paging={controller.paging}
      showFilters={controller.showFilters}
      modal={controller.modal}
      selected={controller.selected}
      canWrite={controller.canWrite}
      canDelete={controller.canDelete}
      showDeleted={controller.showDeleted}
      onToggleDeleted={props.onToggleDeleted}
      columnCustomizer={columnCustomizer}
      renderEntryActions={controller.renderEntryActions}
      renderEntryActionsCards={controller.renderEntryActionsCards}
      formatAmount={controller.formatAmount}
      onModeChange={controller.setMode}
      onSearchChange={controller.setSearch}
      onStatusFilterChange={controller.setStatusFilter}
      onTagFilterChange={controller.setTagFilter}
      onDateFromChange={controller.setDateFrom}
      onDateToChange={controller.setDateTo}
      onShowFiltersChange={controller.setShowFilters}
      onOpenNew={() => {
        controller.setSelected(null);
        controller.setModal("new");
      }}
      onRequestBulkTrash={controller.requestBulkTrash}
      onConfirmBulkTrash={controller.confirmBulkTrash}
      onConfirmRowTrash={controller.confirmRowTrash}
      onExportCsv={controller.exportCSV}
      onToggleSelectedEntry={controller.toggleSelectedEntry}
      onToggleSelectAll={controller.toggleSelectAll}
      onClearSelection={controller.clearSelection}
      onSave={controller.handleSave}
      onAccountsChange={props.onAccountsChange}
      onCloseModal={() => {
        controller.setModal(null);
        controller.setSelected(null);
      }}
      onEditSelected={() => controller.setModal("edit")}
      onViewEntry={(entry) => {
        controller.setSelected(entry);
        controller.setModal("view");
      }}
      onRequestReverse={controller.requestReverse}
      onConfirmReverse={controller.confirmReverse}
      pendingTrashId={controller.pendingTrashId}
      confirmBulkOpen={controller.confirmBulkOpen}
      pendingReverseEntry={controller.pendingReverseEntry}
      onPendingTrashIdChange={controller.setPendingTrashId}
      onConfirmBulkOpenChange={controller.setConfirmBulkOpen}
      onPendingReverseEntryChange={controller.setPendingReverseEntry}
      getColumnWidth={getColumnWidth}
      onColumnResize={onColumnResize}
      pageScopeLabel={controller.pageScopeLabel}
      onRestoreEntry={props.onRestore}
    />
  );
}
