import React, { Suspense, lazy, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, Calendar, Download, Upload } from 'lucide-react';
import { ModulePageShell } from '@/components/ui/ModulePageShell';
import { ResponsiveAccordionTabs } from '@/components/ui/ResponsiveAccordionTabs';
import { ActionButton } from '@/components/ui/ActionButton';
import RouteStatusFallback from '@/components/routing/RouteStatusFallback';
import { SessionsDialogLayer } from '@/tenant/features/sessions/components/SessionsDialogLayer';
import { useAcademicTerms } from '@/hooks/useAcademicTerms';
import { SessionsWorkTier } from '@/tenant/features/sessions/components/SessionsWorkTier';
import { SessionsCommandMetrics } from '@/tenant/features/sessions/components/SessionsCommandMetrics';
import { useSessionsPageController } from '@/tenant/features/sessions/hooks/useSessionsPageController';

const SessionsReportsTier = lazy(() =>
  import('@/tenant/features/sessions/components/SessionsReportsTier').then((m) => ({
    default: m.SessionsReportsTier,
  }))
);
const SessionsSetupTier = lazy(() =>
  import('@/tenant/features/sessions/components/SessionsSetupTier').then((m) => ({
    default: m.SessionsSetupTier,
  }))
);

export default function Sessions() {
  const c = useSessionsPageController();
  const terms = useAcademicTerms();
  const [importOpen, setImportOpen] = useState(false);

  return (
    <ModulePageShell
      seoTitle={`MMS - ${terms.session.plural}`}
      seoDescription={c.t('page.sessions.subtitle')}
      headerIcon={Calendar}
      headerTitle={terms.session.plural}
      headerSubtitle={c.t('page.sessions.subtitle')}
      headerActions={
        <>
          {c.canExport && !c.showDeleted ? (
            <ActionButton variant="ghost" icon={Download} onClick={() => void c.handleExportCSV()}>
              {c.t('common.export')}
            </ActionButton>
          ) : null}
          {c.canWrite && !c.showDeleted ? (
            <ActionButton variant="secondary" icon={Upload} onClick={() => setImportOpen(true)}>
              {c.t('common.import')}
            </ActionButton>
          ) : null}
          {c.canWrite && !c.showDeleted ? (
            <ActionButton variant="primary" icon={Plus} onClick={c.openCreateForm}>
              {c.t('sessions.action.new')}
            </ActionButton>
          ) : null}
        </>
      }
      metricsStrip={
        <SessionsCommandMetrics total={c.shownCount} shown={c.sessions.length} />
      }
    >
      <ResponsiveAccordionTabs
        tabs={c.PAGE_TABS}
        activeTab={c.activeTab}
        onTabChange={c.setActiveTab}
        panelIdPrefix="sessions-tab"
      >
        <AnimatePresence mode="wait">
          {c.activeTab === 'work' ? (
            <div className="space-y-5">
              <SessionsWorkTier
              search={c.search}
              filterStatus={c.filterStatus}
              filterType={c.filterType}
              statusOptions={c.statusOptions}
              typeOptions={c.typeOptions}
              statusLabels={c.statusLabels}
              typeLabels={c.typeLabels}
              viewMode={c.viewMode}
              onViewModeChange={c.setViewMode}
              columnLayout={c.columnLayout}
              canWrite={c.canWrite}
              canDelete={c.canDelete}
              showDeleted={c.showDeleted}
              sessions={c.sessions}
              workPageData={c.workPageData}
              isError={c.isError}
              isWorkLoading={c.isWorkLoading}
              isWorkFetching={c.isWorkFetching}
              useServerWork={c.useServerWork}
              canSelectSessions={c.canSelectSessions}
              selectedIds={c.selectedIds}
              allVisibleSelected={c.allVisibleSelected}
              someVisibleSelected={c.someVisibleSelected}
              sortField={c.sortField}
              sortDir={c.sortDir}
              statusConfig={c.statusConfig}
              typeConfig={c.typeConfig}
              onSearchChange={c.setSearch}
              onStatusFilterToggle={(statusOption) => c.toggleFilter(c.filterStatus, c.setFilterStatus, statusOption)}
              onTypeFilterToggle={(typeOption) => c.toggleFilter(c.filterType, c.setFilterType, typeOption)}
              onClearFilters={c.clearFilters}
              onToggleDeleted={() => c.setShowDeleted((previous) => !previous)}
              onRetry={() => void c.refetch()}
              onCreateSession={c.openCreateForm}
              onOpenDetail={c.setDetailSession}
              onSort={c.handleSort}
              onToggleSelectAll={c.toggleSelectAll}
              onToggleSelectedSession={c.toggleSelectedSession}
              onRequestDelete={c.setPendingDeleteId}
              onRestore={c.handleRestore}
              onRequestBulkDelete={() => c.setConfirmBulkDeleteOpen(true)}
              onRequestBulkRestore={() => c.setConfirmBulkRestoreOpen(true)}
              onBulkStatusChange={c.handleBulkStatusChange}
              bulkStatusPending={c.bulkStatusPending}
              onClearSelection={c.clearSelection}
              onPageChange={c.setListPage}
              canExport={c.canExport}
              onBulkExport={() => void c.handleBulkExport()}
            />
            </div>
          ) : c.activeTab === 'reports' ? (
            <Suspense fallback={<RouteStatusFallback />}>
              <SessionsReportsTier />
            </Suspense>
          ) : c.activeTab === 'setup' ? (
            <Suspense fallback={<RouteStatusFallback />}>
              <SessionsSetupTier />
            </Suspense>
          ) : null}
        </AnimatePresence>
      </ResponsiveAccordionTabs>

      <SessionsDialogLayer
        showForm={c.showForm}
        editSession={c.editSession}
        detailSession={c.detailSession}
        canDelete={c.canDelete}
        pendingDeleteId={c.pendingDeleteId}
        confirmBulkDeleteOpen={c.confirmBulkDeleteOpen}
        confirmBulkRestoreOpen={c.confirmBulkRestoreOpen}
        selectedCount={c.selectedIds.length}
        importOpen={importOpen}
        onCloseImport={() => setImportOpen(false)}
        canWrite={c.canWrite}
        onCloseForm={c.closeForm}
        onSave={c.handleSave}
        onCloseDetail={() => c.setDetailSession(null)}
        onUpdate={c.handleUpdate}
        onEdit={c.openEditForm}
        onRestore={c.handleRestore}
        onPendingDeleteChange={c.setPendingDeleteId}
        onConfirmDelete={c.confirmDelete}
        onBulkDeleteOpenChange={c.setConfirmBulkDeleteOpen}
        onConfirmBulkDelete={c.handleBulkDelete}
        onBulkRestoreOpenChange={c.setConfirmBulkRestoreOpen}
        onConfirmBulkRestore={c.handleBulkRestore}
      />
    </ModulePageShell>
  );
}
