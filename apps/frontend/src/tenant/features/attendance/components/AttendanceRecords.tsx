import React from "react";
import { type AttendanceRecord } from "@/lib/data/attendanceData";
import { ModuleWorkListStateShell } from "@/components/app/ModuleWorkListStateShell";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { AttendanceRecordRowActions } from "./AttendanceRecordRowActions";
import { AttendanceListContent } from "./AttendanceListContent";
import { AttendanceListFilters } from "./AttendanceListFilters";
import { AttendanceBulkActionBar } from "./AttendanceBulkActionBar";
import { AttendanceRecordsConfirmDialogs } from "./AttendanceRecordsConfirmDialogs";
import { useAttendanceRecordsState } from "../hooks/useAttendanceRecordsState";
import type { AttendanceRecordsProps } from "../lib/attendanceRecordsTypes";

export type { AttendanceRecordsProps };

export function AttendanceRecords(props: AttendanceRecordsProps): React.JSX.Element {
  const {
    showDeleted = false,
    onToggleDeleted,
    getColumnWidth,
    onColumnResize,
    columnCustomizer,
    onDeleteRecord,
    onRestoreRecord,
    onMessage,
  } = props;

  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const state = useAttendanceRecordsState(props);

  const createRowActionsRenderer =
    (variant: "table" | "cards") => (attendanceRecord: AttendanceRecord) => (
      <AttendanceRecordRowActions
        attendanceRecord={attendanceRecord}
        editingRecord={state.editingRecord}
        canWriteAttendance={state.canWriteAttendance}
        canDeleteAttendance={state.canDeleteAttendance}
        showDeleted={showDeleted}
        variant={variant}
        onMessage={onMessage}
        onRestoreRecord={onRestoreRecord}
        setEditingRecord={state.setEditingRecord}
        setPendingDeleteId={state.setPendingDeleteId}
        saveEditingRecord={state.saveEditingRecord}
        t={state.t}
      />
    );

  return (
    <section className="space-y-4" aria-busy={state.attendancePageQuery.isFetching}>
      <AttendanceListFilters
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={state.searchInput}
        handleSearchChange={state.setSearchInput}
        statusFilter={state.statusFilter}
        setStatusFilter={state.setStatusFilter}
        statuses={state.statuses}
        statusLabel={state.statusLabel}
        dateFrom={state.dateFrom}
        setDateFrom={state.setDateFrom}
        dateTo={state.dateTo}
        setDateTo={state.setDateTo}
        setPage={state.setListPage}
        canDelete={state.canDeleteAttendance}
        showDeleted={showDeleted}
        onToggleDeleted={onToggleDeleted}
        columnCustomizer={columnCustomizer}
      />

      {state.canDeleteAttendance ? (
        <AttendanceBulkActionBar
          selectedCount={state.selectedIds.length}
          showDeleted={showDeleted}
          canDelete={state.canDeleteAttendance}
          onRequestBulkDelete={() => state.setConfirmBulkOpen(true)}
          onRequestBulkRestore={() => state.setConfirmBulkOpen(true)}
          onClearSelection={() => state.setSelectedIds([])}
        />
      ) : null}

      <ModuleWorkListStateShell
        isError={state.attendancePageQuery.isError}
        isLoading={state.attendancePageQuery.isPending}
        isFetching={state.attendancePageQuery.isFetching}
        onRetry={() => {
          void state.attendancePageQuery.refetch();
        }}
        errorTitle={state.t("attendance.toast.loadFailed")}
        errorHint={state.t("attendance.loadFailedHint")}
        viewMode={viewMode}
        skeletonColumnCount={state.visibleColCount}
        useServerWork={true}
        pageData={{
          page: state.serverPage,
          total: state.serverTotal,
          limit: state.serverLimit,
          hasMore: state.serverHasMore,
        }}
        onPageChange={state.setListPage}
        i18nNamespace="attendance"
        paginationVariant="summary"
        showPagination={true}
        loadingLabel={state.t("common.loading")}
      >
        <AttendanceListContent
          viewMode={viewMode}
          paginatedRecords={state.pageRecords}
          isColumnVisible={state.columnVisible}
          visibleColCount={state.visibleColCount}
          editingRecord={state.editingRecord}
          statuses={state.statuses}
          updateDraft={state.updateDraft}
          classLabel={state.classLabel}
          renderRowActions={createRowActionsRenderer("table")}
          renderRowActionsCards={createRowActionsRenderer("cards")}
          selectedIds={state.selectedIds}
          canDelete={state.canDeleteAttendance}
          allVisibleSelected={state.allVisibleSelected}
          someVisibleSelected={state.someVisibleSelected}
          onToggleSelectAll={state.toggleSelectAll}
          onToggleSelectedRecord={state.toggleSelected}
          getColumnWidth={getColumnWidth}
          onColumnResize={onColumnResize}
          t={state.t}
        />
      </ModuleWorkListStateShell>

      <AttendanceRecordsConfirmDialogs
        pendingDeleteId={state.pendingDeleteId}
        onPendingDeleteChange={state.setPendingDeleteId}
        onConfirmDelete={(id) => void onDeleteRecord(id)}
        confirmBulkOpen={state.confirmBulkOpen}
        onConfirmBulkOpenChange={state.setConfirmBulkOpen}
        showDeleted={showDeleted}
        selectedIdsCount={state.selectedIds.length}
        onConfirmBulkTrash={state.confirmBulkTrash}
        t={state.t}
      />
    </section>
  );
}
