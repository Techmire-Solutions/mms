import React from "react";
import { Globe } from "lucide-react";
import { getAppDomain } from "@/lib/config/tenantConfig";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformWorkspaces } from "@/platform/hooks/usePlatformWorkspaces";
import { usePlatformWorkspaceMetrics } from "@/platform/hooks/usePlatformWorkspaceMetrics";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { usePlatformWorkspaceDescriptor } from "@/platform/hooks/usePlatformWorkspaceDescriptor";
import { useDescriptorColumnLayout } from "@/hooks/useDescriptorColumnLayout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { ModuleWorkListStateShell } from "@/components/app/ModuleWorkListStateShell";
import { PlatformWorkspaceDialogs } from "@/platform/components/workspace/PlatformWorkspaceDialogs";
import { PlatformWorkspaceToolbar } from "@/platform/components/workspace/PlatformWorkspaceToolbar";
import { usePlatformWorkspaceUrlState } from "@/platform/components/workspace/usePlatformWorkspaceUrlState";
import { downloadWorkspacesCsv } from "@/platform/components/platformWorkspaceListData";
import { PlatformWorkspaceDirectoryView } from "@/platform/components/workspace/PlatformWorkspaceDirectoryView";
import { useWorkspaceDeleteState } from "@/platform/components/workspace/useWorkspaceDeleteState";
import { usePlatformWorkspaceModalState } from "@/platform/components/workspace/usePlatformWorkspaceModalState";
import { usePlatformWorkspaceSelection } from "@/platform/components/workspace/usePlatformWorkspaceSelection";
import { PlatformWorkspaceBulkDock } from "@/platform/components/workspace/PlatformWorkspaceBulkDock";
import { usePlatformWorkspaceListActions } from "@/platform/components/workspace/usePlatformWorkspaceListActions";
import { usePlatformDensity } from "@/platform/hooks/usePlatformDensity";

/**
 * Workspace list with enable/disable, modules, break-glass admin tools, and super-user delete.
 */
export default function PlatformWorkspaceList(): React.JSX.Element {
  const { t } = useTranslation();
  const { isSuperUser } = usePlatformPermissions();
  const appDomain = getAppDomain();

  const {
    search,
    statusFilter,
    sortField,
    sortDirection,
    page,
    pageSize,
    setSearch,
    setStatusFilter,
    toggleSort,
    setPage,
    isFiltered,
    handleClearFilters,
  } = usePlatformWorkspaceUrlState();

  const sortFieldApi = sortField === "name" ? ("name" as const) : sortField;

  const {
    data: workspaces,
    total: filteredTotal,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = usePlatformWorkspaces({
    page,
    limit: pageSize,
    search: search || undefined,
    status: statusFilter,
    sortField: sortFieldApi,
    sortDir: sortDirection,
  });

  const { data: metrics } = usePlatformWorkspaceMetrics();

  const descriptor = usePlatformWorkspaceDescriptor();
  const columnLayout = useDescriptorColumnLayout("platform.workspaces", descriptor);
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const { density, setDensity } = usePlatformDensity();
  const deleteState = useWorkspaceDeleteState();
  const modalState = usePlatformWorkspaceModalState();
  const listActions = usePlatformWorkspaceListActions();

  const items = workspaces ?? [];
  const selection = usePlatformWorkspaceSelection(items);

  const totalCount = metrics?.total ?? filteredTotal;
  const activeCount = metrics?.active ?? 0;
  const inactiveCount = metrics?.inactive ?? 0;

  return (
    <div className="space-y-6 w-full text-start pb-24 scroll-pb-24">
      <PlatformWorkspaceToolbar
        shownCount={filteredTotal}
        totalCount={totalCount}
        activeCount={activeCount}
        inactiveCount={inactiveCount}
        search={search}
        onSearchChange={setSearch}
        isSearching={isFetching}
        hasActiveFilters={isFiltered}
        onClearFilters={handleClearFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        density={density}
        onDensityChange={setDensity}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sortField={sortField}
        sortDirection={sortDirection}
        onToggleSort={toggleSort}
        onRefetch={() => void refetch()}
        onExportCsv={() => downloadWorkspacesCsv(items)}
        columnLayout={columnLayout}
      />

      <ModuleWorkListStateShell
        isError={isError}
        isLoading={isLoading}
        isFetching={isFetching}
        onRetry={() => void refetch()}
        errorTitle={t("platform.loadFailed")}
        errorHint={t("platform.loadFailedHint")}
        viewMode={viewMode}
        skeletonColumnCount={5}
        useServerWork
        pageData={{
          page,
          total: filteredTotal,
          limit: pageSize,
          hasMore: page * pageSize < filteredTotal,
        }}
        onPageChange={setPage}
        i18nNamespace="platform"
        showPagination={filteredTotal > pageSize}
        loadingLabel={t("common.loading")}
      >
        {filteredTotal === 0 ? (
          <div className="bg-card border border-border/40 rounded-xl p-6">
            <EmptyState
              icon={Globe}
              title={isFiltered ? t("platform.noSearchResults") : t("apex.noMadrasasYet")}
              action={
                isFiltered ? (
                  <Button variant="outline" onClick={handleClearFilters}>
                    {t("common.clearFilters")}
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <PlatformWorkspaceDirectoryView
            viewMode={viewMode}
            workspaces={items}
            descriptor={descriptor}
            columnLayout={columnLayout}
            appDomain={appDomain}
            density={density}
            sortField={sortField}
            sortDirection={sortDirection}
            onToggleSort={toggleSort}
            togglePending={listActions.togglePending}
            deletePending={deleteState.deletePending}
            targetWorkspaceSubdomain={deleteState.targetWorkspace?.subdomain}
            onToggleEnabled={listActions.handleToggleEnabled}
            onToggleEmailVerification={listActions.handleToggleEmailVerification}
            onOpenModules={modalState.handleOpenModules}
            onOpenDelete={isSuperUser ? deleteState.handleOpenDelete : undefined}
            onOpenResetPassword={modalState.handleOpenResetPassword}
            onOpenCreateAdmin={modalState.handleOpenCreateAdmin}
            onInspect={modalState.handleOpenInspect}
            selectedSubdomains={selection.selectedSubdomains}
            onToggleSelect={selection.toggleSelect}
            onToggleSelectAll={() => selection.toggleSelectAll(items)}
          />
        )}
      </ModuleWorkListStateShell>

      <PlatformWorkspaceDialogs
        appDomain={appDomain}
        deleteState={deleteState}
        modalState={modalState}
        descriptor={descriptor}
      />

      <PlatformWorkspaceBulkDock
        selectedCount={selection.selectedCount}
        selectedWorkspaces={selection.selectedWorkspaces}
        onClearSelection={selection.clearSelection}
        onBulkEnable={listActions.handleBulkEnable}
        onBulkDisable={listActions.handleBulkDisable}
        busy={listActions.togglePending}
      />
    </div>
  );
}
