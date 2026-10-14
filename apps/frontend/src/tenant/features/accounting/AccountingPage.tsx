import React from "react";
import { AnimatePresence } from "framer-motion";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { ResponsiveAccordionTabs } from "@/components/app/ResponsiveAccordionTabs";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { accountingTransferSchema } from "@mms/shared";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { AccountingPageHeaderActions } from "@/tenant/features/accounting/components/AccountingPageHeaderActions";
import { AccountingCsvImportDialog } from "@/tenant/features/accounting/components/AccountingCsvImportDialog";
import { AccountingWorkTier } from "@/tenant/features/accounting/components/AccountingWorkTier";
import { AccountingCommandMetrics } from "@/tenant/features/accounting/components/AccountingCommandMetrics";
import { ACCOUNTING_PAGE_ICON } from "@/tenant/features/accounting/accountingPageSubTabs";
import { JOURNAL_PAGE_SIZE } from "@/tenant/features/accounting/lib/journalEntriesControllerFilters";
import { useAccountingPageController } from "@/tenant/features/accounting/hooks/useAccountingPageController";

const AccountingReportsTier = React.lazy(() =>
  import("@/tenant/components/moduleReports").then((m) => ({ default: m.ModuleReportsTier })),
);
const AccountingSetupTier = React.lazy(() =>
  import("@/tenant/features/accounting/components/AccountingSetupTier").then((m) => ({
    default: m.AccountingSetupTier,
  })),
);

/**
 * Accounting and bookkeeping — Work | Reports | Setup.
 */
export default function Accounting() {
  const c = useAccountingPageController();
  const [importOpen, setImportOpen] = React.useState(false);
  const { handleExport, isExporting } = useGenericModuleExport({
    path: "/api/accounting/export/csv",
    filename: "accounting-journals.csv",
    auditPath: "/api/accounting/export-audit",
    columns: accountingTransferSchema.exportColumns,
    canExport: c.canWrite,
  });
  const {
    t,
    canWrite,
    canDelete,
    pageTabs,
    subTabs,
    activeTab,
    setActiveTab,
    activeSubTab,
    setActiveSubTab,
    showDeleted,
    setShowDeleted,
    createJournalRequestKey,
    createAccountRequestKey,
    accounts,
    journalEntries,
    aggregateEntries,
    fiscalYears,
    accountsResult,
    entriesResult,
    aggregateEntriesResult,
    journalTotal,
    filteredCount,
    setFilteredCount,
    settings,
    activeFiscalYear,
    activeCurrency,
    listLoadFailed,
    journalList,
    journalColumnLayout,
    accountColumnLayout,
    setAccounts,
    setEntries,
    setFiscalYears,
    handleDeleteEntry,
    handleRestoreEntry,
    handleBulkDeleteEntries,
    handleBulkRestoreEntries,
    handleShortcutStateChange,
    openJournalCreate,
  } = c;

  return (
    <ModulePageShell
      seoTitle={`MMS - ${t("nav.accounting")}`}
      seoDescription={t("page.accounting.subtitle")}
      headerIcon={ACCOUNTING_PAGE_ICON}
      headerTitle={t("nav.accounting")}
      headerSubtitle={`${t("page.accounting.subtitle")}${activeFiscalYear ? ` · ${activeFiscalYear.label}` : ""} · ${activeCurrency.code}`}
      headerActions={
        <AccountingPageHeaderActions
          canWrite={canWrite}
          canExport={canWrite}
          isExporting={isExporting}
          showDeleted={showDeleted}
          activeFiscalYear={activeFiscalYear}
          onCreateJournal={openJournalCreate}
          onImport={() => setImportOpen(true)}
          onExport={handleExport}
        />
      }
      metricsStrip={<AccountingCommandMetrics entryTotal={journalTotal} shown={filteredCount} />}
    >
      <ResponsiveAccordionTabs
        tabs={pageTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        panelIdPrefix="accounting-tab"
      >
        <AnimatePresence mode="wait">
          <ModuleTierMotion
            tier={activeTab + "-" + activeSubTab + "-" + String(showDeleted)}
            className="space-y-4"
          >
            <ErrorBoundary>
              {activeTab === "reports" && (
                <React.Suspense fallback={<RouteStatusFallback />}>
                  <AccountingReportsTier category="accounting" />
                </React.Suspense>
              )}

              {activeTab === "work" && (
                <div className="space-y-5">
                  <AccountingWorkTier
                    accounts={accounts}
                    accountsLoaded={accountsResult.isSuccess}
                    entries={journalEntries}
                    aggregateEntries={aggregateEntries}
                    fiscalYears={fiscalYears}
                    settings={settings}
                    activeSubTab={activeSubTab}
                    subTabs={subTabs}
                    showDeleted={showDeleted}
                    canWrite={canWrite}
                    canDelete={canDelete}
                    listLoadFailed={listLoadFailed}
                    journalFilters={journalList.filters}
                    onJournalFiltersChange={journalList.patchFilters}
                    journalPaging={{
                      page: journalList.page,
                      limit: JOURNAL_PAGE_SIZE,
                      total: journalTotal,
                      hasMore: entriesResult.data?.hasMore ?? false,
                      onPageChange: journalList.setPage,
                    }}
                    createJournalRequestKey={createJournalRequestKey}
                    createAccountRequestKey={createAccountRequestKey}
                    onSubTabChange={(next) => {
                      setActiveSubTab(next);
                      if (next !== "journal") setShowDeleted(false);
                    }}
                    onShowDeletedChange={() => setShowDeleted((prev) => !prev)}
                    onRetry={() => {
                      void accountsResult.refetch();
                      void entriesResult.refetch();
                      void aggregateEntriesResult.refetch();
                    }}
                    onAccountsChange={setAccounts}
                    onEntriesChange={setEntries}
                    onFilteredCountChange={setFilteredCount}
                    onShortcutStateChange={handleShortcutStateChange}
                    onDeleteEntry={handleDeleteEntry}
                    onRestoreEntry={handleRestoreEntry}
                    onBulkDeleteEntries={handleBulkDeleteEntries}
                    onBulkRestoreEntries={handleBulkRestoreEntries}
                    journalColumnProps={{
                      isColumnVisible: journalColumnLayout.isColumnVisible,
                      getColumnWidth: journalColumnLayout.getColumnWidth,
                      onColumnResize: journalColumnLayout.setColumnWidth,
                      columnCustomizer: {
                        columnRegistry: journalColumnLayout.columnRegistry,
                        updateUserColumnLayout: journalColumnLayout.updateUserColumnLayout,
                        onResetLayout: journalColumnLayout.resetColumnLayout,
                        labels: journalColumnLayout.customizerLabels,
                      },
                    }}
                    accountColumnProps={{
                      isColumnVisible: accountColumnLayout.isColumnVisible,
                      getColumnWidth: accountColumnLayout.getColumnWidth,
                      onColumnResize: accountColumnLayout.setColumnWidth,
                      columnCustomizer: {
                        columnRegistry: accountColumnLayout.columnRegistry,
                        updateUserColumnLayout: accountColumnLayout.updateUserColumnLayout,
                        onResetLayout: accountColumnLayout.resetColumnLayout,
                        labels: accountColumnLayout.customizerLabels,
                      },
                    }}
                    showActiveLabel={t("accounting.trash.showActive")}
                    showDeletedLabel={t("accounting.trash.showDeleted")}
                    loadFailedTitle={t("accounting.loadFailed")}
                  />
                </div>
              )}

              {activeTab === "setup" && (
                <React.Suspense fallback={<RouteStatusFallback />}>
                  <AccountingSetupTier
                    accounts={accounts}
                    fiscalYears={fiscalYears}
                    onSaveFiscalYears={setFiscalYears}
                    onAccountsChange={setAccounts}
                  />
                </React.Suspense>
              )}
            </ErrorBoundary>
          </ModuleTierMotion>
        </AnimatePresence>
      </ResponsiveAccordionTabs>

      <AccountingCsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        canWrite={canWrite}
      />
    </ModulePageShell>
  );
}
