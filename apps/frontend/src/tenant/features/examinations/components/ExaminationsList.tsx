import React, { useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModuleWorkListStateShell } from "@/components/app/ModuleWorkListStateShell";
import { useExamSelection } from "@/tenant/features/examinations/hooks/useExamSelection";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useEnrollmentsCollection } from "@/tenant/hooks/collections/enrollments";
import { ExaminationsListContent } from "@/tenant/features/examinations/components/ExaminationsListContent";
import { ExaminationsListFilters } from "@/tenant/features/examinations/components/ExaminationsListFilters";
import { ExaminationsBulkActionBar } from "@/tenant/features/examinations/components/ExaminationsBulkActionBar";
import { ExaminationsTrashDialogs } from "@/tenant/features/examinations/components/ExaminationsTrashDialogs";
import {
  resolveExaminationStatusConfig,
  resolveExaminationStatusLabels,
} from "@/tenant/features/examinations/lib/examinationStatusConfig";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useExaminationsTrashState } from "@/tenant/features/examinations/hooks/useExaminationsTrashState";
import { useExaminationsDirectoryQuery } from "@/tenant/features/examinations/hooks/useExaminationsDirectoryQuery";
import type { ExaminationsListProps } from "../lib/examinationsListTypes";

export type { ExaminationsListProps };

const ALWAYS_COLUMN_VISIBLE = (_key: string): boolean => true;

/**
 * Renders the dashboard list of created exams (cards or table) — server-paged.
 */
export default function ExaminationsList(props: ExaminationsListProps): React.JSX.Element {
  const {
    onNew,
    onEdit,
    canWrite = true,
    canDelete = false,
    showDeleted = false,
    onToggleDeleted,
    createRequestKey = 0,
    onDelete,
    onRestore,
    onBulkDelete,
    onBulkRestore,
    isColumnVisible,
    getColumnWidth,
    onColumnResize,
    columnCustomizer,
    onRowClick,
  } = props;
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const query = useExaminationsDirectoryQuery(props);

  const sessions = useSessionsCollection();
  const enrollments = useEnrollmentsCollection();
  const classes = sessions.flatMap((session) =>
    (session.classes || []).map((sessionClass) => ({
      id: sessionClass.id,
      name: `${session.name} - ${sessionClass.name}`,
    })),
  );

  const statusLabels = resolveExaminationStatusLabels(t);

  useEffect(() => {
    if (createRequestKey > 0 && canWrite && !showDeleted) onNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- createRequestKey drives open
  }, [createRequestKey, canWrite, showDeleted]);

  const {
    selectedIds,
    setSelectedIds,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectAll,
    toggleSelectedExam,
  } = useExamSelection(query.pageExams);

  const trash = useExaminationsTrashState({
    ...props,
    selectedIds,
    onClearSelection: () => setSelectedIds([]),
  });

  useEffect(() => {
    setSelectedIds([]);
  }, [showDeleted, query.listPage, query.debouncedSearch, query.filterStatus, setSelectedIds]);

  const columnVisible = isColumnVisible ?? ALWAYS_COLUMN_VISIBLE;
  const statusConfig = resolveExaminationStatusConfig(statusLabels);
  const canBulkTrash = canDelete && Boolean(showDeleted ? onBulkRestore : onBulkDelete);
  const isInitialLoading = query.examsPageQuery.isPending && !query.examsPageQuery.data;
  const isError =
    query.examsPageQuery.isError ||
    (query.examsPageQuery.data != null && query.examsPageQuery.data.status !== 200);

  return (
    <section
      className="space-y-4"
      aria-label={t("examinations.exams")}
      aria-busy={query.examsPageQuery.isFetching}
    >
      <ExaminationsListFilters
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={query.search}
        filterStatus={query.filterStatus}
        canWrite={canWrite}
        canDelete={canDelete}
        showDeleted={showDeleted}
        onToggleDeleted={onToggleDeleted}
        columnCustomizer={columnCustomizer}
        statusLabels={statusLabels}
        onSearchChange={query.setSearch}
        onToggleStatus={query.toggleStatus}
        onClearStatuses={query.clearStatuses}
        onNew={onNew}
      />

      {canBulkTrash && (
        <ExaminationsBulkActionBar
          selectedCount={selectedIds.length}
          showDeleted={showDeleted}
          canDelete={canDelete}
          onRequestBulkDelete={() => trash.setConfirmBulkOpen(true)}
          onRequestBulkRestore={() => trash.setConfirmBulkOpen(true)}
          onClearSelection={() => setSelectedIds([])}
        />
      )}

      <ModuleWorkListStateShell
        isError={isError}
        isLoading={isInitialLoading}
        isFetching={query.examsPageQuery.isFetching}
        onRetry={() => {
          void query.examsPageQuery.refetch();
        }}
        errorTitle={t("examinations.loadFailed")}
        errorHint={t("examinations.loadFailedHint")}
        viewMode={viewMode}
        skeletonColumnCount={6}
        useServerWork={true}
        pageData={{
          page: query.serverPage,
          total: query.serverTotal,
          limit: query.serverLimit,
          hasMore: query.serverHasMore,
        }}
        onPageChange={query.setListPage}
        i18nNamespace="examinations"
        showPagination={true}
        loadingLabel={t("common.loading")}
      >
        <ExaminationsListContent
          viewMode={viewMode}
          exams={query.pageExams}
          selectedIds={selectedIds}
          isColumnVisible={columnVisible}
          classes={classes}
          enrollments={enrollments}
          allVisibleSelected={allVisibleSelected}
          someVisibleSelected={someVisibleSelected}
          canWrite={canWrite}
          canDelete={canDelete}
          showDeleted={showDeleted}
          canTrashRows={canDelete && Boolean(showDeleted ? onRestore : onDelete)}
          statusConfig={statusConfig}
          getColumnWidth={getColumnWidth}
          onColumnResize={onColumnResize}
          onEdit={onEdit}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelectedExam={toggleSelectedExam}
          onRowClick={onRowClick}
          onTrashAction={(id) => {
            if (showDeleted) void onRestore?.(id);
            else trash.setPendingTrashId(id);
          }}
        />
      </ModuleWorkListStateShell>
      <ExaminationsTrashDialogs
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
