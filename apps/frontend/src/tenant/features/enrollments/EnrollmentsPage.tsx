import React, { Suspense, lazy, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ClipboardList } from "lucide-react";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { ResponsiveAccordionTabs } from "@/components/app/ResponsiveAccordionTabs";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { EnrollmentsCommandMetrics } from "@/tenant/features/enrollments/components/EnrollmentsCommandMetrics";
import { EnrollmentsPageModals } from "@/tenant/features/enrollments/components/EnrollmentsPageModals";
import { EnrollmentsWorkTier } from "@/tenant/features/enrollments/components/EnrollmentsWorkTier";
import { EnrollmentsPageHeaderActions } from "@/tenant/features/enrollments/components/EnrollmentsPageHeaderActions";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ENROLLMENTS_MODULE_MANIFEST } from "@mms/shared";
import { useEnrollmentsPageState } from "@/tenant/features/enrollments/hooks/useEnrollmentsPageState";

const EnrollmentsReportsTier = lazy(() =>
  import("@/tenant/components/moduleReports").then((m) => ({ default: m.ModuleReportsTier })),
);
const EnrollmentsSetupTier = lazy(() =>
  import("@/tenant/features/enrollments/components/EnrollmentsSetupTier").then((m) => ({
    default: m.EnrollmentsSetupTier,
  })),
);

/**
 * Enrollments management — Work | Reports | Setup.
 */
export default function EnrollmentsPage() {
  const pageState = useEnrollmentsPageState();
  const [importOpen, setImportOpen] = useState(false);
  const {
    t,
    SUB_TABS,
    TABS,
    tab,
    setTab,
    activeSubTab,
    setActiveSubTab,
    canWriteEnrollments,
    canDelete,
    canExport,
    canSelectEnrollments,
    directoryFilters,
    enrollments,
    filteredCount,
    isWorkPageError,
    refetchWorkPage,
    setViewing,
    setShowWizard,
    setPendingDeleteId,
    setConfirmBulkDeleteOpen,
    setConfirmBulkRestoreOpen,
    columnLayout,
    selection,
    exportActions,
    pageActions,
  } = pageState;

  const {
    listPage,
    setListPage,
    showDeleted,
    setShowDeleted,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sessionFilter,
    setSessionFilter,
  } = directoryFilters;

  const {
    selectedIds,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectAll,
    toggleSelected,
    clearSelection,
  } = selection;

  const { handleExportCSV, handleBulkExport } = exportActions;
  const { handleCancel, handleRestore, handleBulkCancel } = pageActions;

  return (
    <ModulePageShell
      seoTitle={`MMS - ${t("nav.enrollments")}`}
      seoDescription={t("page.enrollments.subtitle")}
      headerIcon={ClipboardList}
      headerTitle={t("nav.enrollments")}
      headerSubtitle={t("page.enrollments.subtitle")}
      headerActions={
        <EnrollmentsPageHeaderActions
          canExport={canExport}
          canWriteEnrollments={canWriteEnrollments}
          showDeleted={showDeleted}
          t={t}
          onExport={() => void handleExportCSV()}
          onImport={() => setImportOpen(true)}
          onNew={() => {
            setTab("work");
            setShowWizard(true);
          }}
        />
      }
      metricsStrip={<EnrollmentsCommandMetrics total={filteredCount} shown={filteredCount} />}
    >
      <ResponsiveAccordionTabs
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
        panelIdPrefix="enrollments-tab"
      >
        <AnimatePresence mode="wait">
          <ModuleTierMotion
            tier={tab + "-" + activeSubTab + (showDeleted ? "-trash" : "")}
            className="space-y-4"
          >
            {tab === "reports" && (
              <ErrorBoundary>
                <Suspense fallback={<RouteStatusFallback />}>
                  <EnrollmentsReportsTier category="enrollments" />
                </Suspense>
              </ErrorBoundary>
            )}

            {tab === "work" && (
              <div className="space-y-5">
                <EnrollmentsWorkTier
                  activeSubTab={activeSubTab}
                  subTabs={SUB_TABS}
                  enrollments={enrollments}
                  total={filteredCount}
                  page={listPage}
                  pageSize={ENROLLMENTS_MODULE_MANIFEST.defaultPageSize}
                  search={search}
                  statusFilter={statusFilter}
                  sessionFilter={sessionFilter}
                  canWrite={canWriteEnrollments}
                  canDelete={canDelete}
                  canExport={canExport}
                  canSelectEnrollments={canSelectEnrollments}
                  showDeleted={showDeleted}
                  selectedIds={selectedIds}
                  allVisibleSelected={allVisibleSelected}
                  someVisibleSelected={someVisibleSelected}
                  isWorkListError={isWorkPageError}
                  loadFailedTitle={t("enrollments.loadFailed")}
                  onSubTabChange={setActiveSubTab}
                  onRetry={() => void refetchWorkPage()}
                  onShowDeletedChange={setShowDeleted}
                  onSearchChange={setSearch}
                  onStatusFilterChange={setStatusFilter}
                  onSessionFilterChange={setSessionFilter}
                  onClearFilters={() => {
                    setStatusFilter("all");
                    setSessionFilter("all");
                    setSearch("");
                  }}
                  onPageChange={setListPage}
                  onView={setViewing}
                  onCancel={handleCancel}
                  onDeleteRequest={setPendingDeleteId}
                  onRestore={handleRestore}
                  onToggleSelectAll={toggleSelectAll}
                  onToggleSelectedEnrollment={toggleSelected}
                  onClearSelection={clearSelection}
                  onRequestBulkDelete={() => setConfirmBulkDeleteOpen(true)}
                  onRequestBulkRestore={() => setConfirmBulkRestoreOpen(true)}
                  onRequestBulkCancel={() => handleBulkCancel(selectedIds)}
                  onBulkExport={() => void handleBulkExport()}
                  columnProps={{
                    isColumnVisible: columnLayout.isColumnVisible,
                    getColumnWidth: columnLayout.getColumnWidth,
                    onColumnResize: columnLayout.setColumnWidth,
                    columnCustomizer: {
                      columnRegistry: columnLayout.columnRegistry,
                      updateUserColumnLayout: columnLayout.updateUserColumnLayout,
                      onResetLayout: columnLayout.resetColumnLayout,
                      labels: columnLayout.customizerLabels,
                    },
                  }}
                />
              </div>
            )}

            {tab === "setup" && (
              <ErrorBoundary>
                <Suspense fallback={<RouteStatusFallback />}>
                  <EnrollmentsSetupTier />
                </Suspense>
              </ErrorBoundary>
            )}
          </ModuleTierMotion>
        </AnimatePresence>
      </ResponsiveAccordionTabs>

      <EnrollmentsPageModals
        pageState={pageState}
        importOpen={importOpen}
        onCloseImport={() => setImportOpen(false)}
      />
    </ModulePageShell>
  );
}
