import { useEffect } from "react";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { HasanatTrashDialogs } from "./HasanatTrashDialogs";
import { ModuleWorkListStateShell } from "@/components/ui/ModuleWorkListStateShell";
import { useTranslation } from "@/hooks/useTranslation";
import { DistributeModal } from "./DistributeModal";
import { DistributionsListContent } from "./DistributionsListContent";
import { DistributionsListFilters } from "./DistributionsListFilters";
import { HasanatBulkActionBar } from "./HasanatBulkActionBar";
import { useDistributionsList } from "../hooks/useDistributionsList";
import { useDistributionsTrashState } from "../hooks/useDistributionsTrashState";
import type { DistributionsListProps } from "./distributionsListTypes";

export type { DistributionsListProps };

const ALWAYS_COLUMN_VISIBLE = (_key: string): boolean => true;

/**
 * DistributionsList Component
 *
 * Renders the ledger interface for tracking physical reward cards distributed to students or faculty.
 */
export function DistributionsList(props: DistributionsListProps) {
  const {
    denoms,
    batches,
    onDenomsChange,
    canWrite = true,
    canDelete = false,
    showDeleted = false,
    onToggleDeleted,
    selectedIds = [],
    onToggleSelectedDistribution,
    onToggleSelectAll,
    onClearSelection,
    isColumnVisible,
    getColumnWidth,
    onColumnResize,
    columnCustomizer,
    onMessage,
    onRowClick,
    onRestore,
    onDelete,
    onBulkRestore,
    onBulkDelete,
  } = props;
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const list = useDistributionsList(props);
  const trash = useDistributionsTrashState(props);

  const selectedSet = new Set(selectedIds);
  const allVisibleSelected =
    list.pageDistributions.length > 0 &&
    list.pageDistributions.every((distribution) => selectedSet.has(distribution.id));
  const someVisibleSelected =
    selectedSet.size > 0 &&
    list.pageDistributions.some((distribution) => selectedSet.has(distribution.id));

  useEffect(() => {
    onClearSelection?.();
  }, [list.listPage, list.search, list.filterStatus, onClearSelection]);

  const columnVisible = isColumnVisible ?? ALWAYS_COLUMN_VISIBLE;
  const canBulkTrash = canDelete && Boolean(showDeleted ? onBulkRestore : onBulkDelete);

  return (
    <section aria-label={t("hasanat.distribution.aria")} className="space-y-4">
      <DistributionsListFilters
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={list.search}
        filterStatus={list.filterStatus}
        statusLabels={list.statusLabels}
        canWrite={canWrite}
        canDelete={canDelete}
        showDeleted={showDeleted}
        onToggleDeleted={onToggleDeleted}
        columnCustomizer={columnCustomizer}
        onSearchChange={list.setSearch}
        onToggleStatus={list.toggleStatus}
        onClearStatuses={() => list.setFilterStatus([])}
        onOpenModal={() => list.setShowModal(true)}
      />

      {canBulkTrash && (
        <HasanatBulkActionBar
          selectedCount={selectedIds.length}
          showDeleted={showDeleted}
          canDelete={canDelete}
          onRequestBulkDelete={() => trash.setConfirmBulkOpen(true)}
          onRequestBulkRestore={() => trash.setConfirmBulkOpen(true)}
          onClearSelection={onClearSelection ?? (() => {})}
        />
      )}

      <ModuleWorkListStateShell
        isError={list.pageQuery.isError}
        isLoading={list.pageQuery.isLoading}
        isFetching={list.pageQuery.isFetching}
        onRetry={() => {
          void list.pageQuery.refetch();
        }}
        errorTitle={t("hasanat.loadFailed")}
        errorHint={t("hasanat.loadFailedHint")}
        viewMode={viewMode}
        skeletonColumnCount={6}
        useServerWork={true}
        pageData={{
          page: list.serverPage,
          total: list.serverTotal,
          limit: list.serverLimit,
          hasMore: list.serverHasMore,
        }}
        onPageChange={list.setListPage}
        i18nNamespace="hasanat"
        showPagination={true}
        loadingLabel={t("common.loading")}
      >
        <DistributionsListContent
          viewMode={viewMode}
          distributions={list.pageDistributions}
          denoms={denoms}
          selectedIds={selectedIds}
          allVisibleSelected={allVisibleSelected}
          someVisibleSelected={someVisibleSelected}
          isColumnVisible={columnVisible}
          statusLabels={list.statusLabels}
          statusConfig={list.statusConfig}
          canWrite={canWrite}
          canDelete={canDelete}
          showDeleted={showDeleted}
          canRestoreRows={!!onRestore}
          canDeleteRows={!!onDelete}
          onMessage={onMessage}
          onRowClick={
            onRowClick
              ? (id) => {
                  const distribution = list.pageDistributions.find((item) => item.id === id);
                  if (distribution) onRowClick(distribution);
                }
              : undefined
          }
          onChangeStatus={list.changeStatus}
          onToggleSelectedDistribution={(id, checked) =>
            onToggleSelectedDistribution?.(id, checked)
          }
          onToggleSelectAll={(checked) =>
            onToggleSelectAll?.(
              checked,
              list.pageDistributions.map((d) => d.id),
            )
          }
          onTrashAction={(id) => {
            if (showDeleted) void onRestore?.(id);
            else trash.setPendingTrashId(id);
          }}
          getColumnWidth={getColumnWidth}
          onColumnResize={onColumnResize}
        />
      </ModuleWorkListStateShell>

      {canWrite && !showDeleted && (
        <DistributeModal
          open={list.showModal}
          denoms={denoms}
          batches={batches}
          onClose={() => list.setShowModal(false)}
          onSave={list.handleDistribute}
          onDenomsChange={onDenomsChange}
        />
      )}

      <HasanatTrashDialogs
        pendingTrashId={trash.pendingTrashId}
        onPendingTrashIdChange={trash.setPendingTrashId}
        confirmBulkOpen={trash.confirmBulkOpen}
        onConfirmBulkOpenChange={trash.setConfirmBulkOpen}
        showDeleted={showDeleted}
        selectedCount={selectedIds.length}
        onConfirmRowTrash={trash.confirmRowTrash}
        onConfirmBulkTrash={trash.confirmBulkTrash}
      />
    </section>
  );
}
