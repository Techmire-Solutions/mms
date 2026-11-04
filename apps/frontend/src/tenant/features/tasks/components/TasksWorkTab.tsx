/**
 * @file TasksWorkTab.tsx
 * @description Tasks Work tier — toolbar, selection, directory, detail drawer.
 */

import React, { useState } from "react";
import type { TaskRecord, TaskStatus } from "@mms/shared";
import { useTasksWorkTabFilters } from "../hooks/useTasksWorkTabFilters";
import { useTasksKeyboardShortcuts } from "../hooks/useTasksKeyboardShortcuts";
import { useTaskSelectionScope } from "../hooks/useTaskSelectionScope";
import { buildTaskFilterScopeKey } from "../lib/taskFilterScope";
import type { TaskServerFilters } from "../lib/tasksServerFilters";
import { useTaskServerFiltersSync } from "../hooks/useTaskServerFiltersSync";
import { useTasksBulkActions } from "../hooks/useTasksBulkActions";
import { TasksPaginationFooter } from "./TasksPaginationFooter";
import { TasksEmptyCreateAction, TasksWorkToolbar } from "./TasksWorkToolbar";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import { useTasksColumnLayout } from "../hooks/useTasksColumnLayout";
import { useTask } from "@/tenant/hooks/collections/tasks";
import { useOptionalAuth } from "@/lib/contexts/AuthContext";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { TasksBulkActionBar } from "./TasksBulkActionBar";
import { TasksWorkDirectory } from "./TasksWorkDirectory";

export interface TasksWorkTabProps {
  tasks: TaskRecord[];
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  canWrite: boolean;
  canComplete?: boolean;
  statusPending?: boolean;
  canDelete: boolean;
  viewingDeleted?: boolean;
  selectedIds: string[];
  onToggleSelected: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean, visibleIds: string[]) => void;
  onClearSelection: () => void;
  onToggleTrash?: (next: boolean) => void;
  onAddNew: () => void;
  onEdit: (task: TaskRecord) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onUpdateStatus: (task: TaskRecord, status: TaskStatus) => void;
  total: number;
  pageIndex: number;
  pageSize: number;
  onPageChange: (pageIndex: number) => void;
  onServerFiltersChange: (filters: TaskServerFilters) => void;
}

export function TasksWorkTab({
  tasks,
  isLoading,
  isError = false,
  onRetry,
  canWrite,
  canComplete,
  statusPending = false,
  canDelete,
  viewingDeleted = false,
  selectedIds,
  onToggleSelected,
  onToggleSelectAll,
  onClearSelection,
  onToggleTrash,
  onAddNew,
  onEdit,
  onDelete,
  onRestore,
  onUpdateStatus,
  total,
  pageIndex,
  pageSize,
  onPageChange,
  onServerFiltersChange,
}: TasksWorkTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    quickFilter,
    setQuickFilter,
    quickFilterOptions,
    search,
    searchInput,
    setSearchInput,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    dueFrom,
    setDueFrom,
    dueTo,
    setDueTo,
    activeChips,
    hasActiveFilters,
    handleClearFilters,
  } = useTasksWorkTabFilters();
  const auth = useOptionalAuth();
  const currentUserId = auth?.user?.id ? String(auth.user.id) : undefined;

  useTasksKeyboardShortcuts({
    selectedCount: selectedIds.length,
    hasActiveFilters,
    clearFilters: handleClearFilters,
    clearSelection: onClearSelection,
    canWrite,
    viewingDeleted,
    onCreate: onAddNew,
  });

  useTaskServerFiltersSync(
    { quickFilter, search, statusFilter, priorityFilter, dueFrom, dueTo, currentUserId },
    onServerFiltersChange,
  );

  // Clearing on any filter/search change prevents a bulk archive from hitting
  // rows the user can no longer see (`mms-module-architecture` §3).
  useTaskSelectionScope(
    buildTaskFilterScopeKey({
      quickFilter,
      search,
      statusFilter,
      priorityFilter,
      dueFrom,
      dueTo,
      page: pageIndex,
    }),
    onClearSelection,
  );
  // Keep the drawer pointed at an id, not a snapshot: the detail query and the
  // current list row both refresh after a status change or restore, so the
  // drawer cannot show a stale badge or archived banner.
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);
  const { data: fetchedTask } = useTask(viewingTaskId ?? "", {
    enabled: Boolean(viewingTaskId),
  });
  const viewingTask = fetchedTask ?? tasks.find((task) => task.id === viewingTaskId) ?? null;
  const parentTaskId = viewingTask?.parentTaskId ?? "";
  const { data: parentTask } = useTask(parentTaskId, { enabled: Boolean(parentTaskId) });
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const {
    columnRegistry,
    isColumnVisible,
    getColumnWidth,
    setColumnWidth,
    updateUserColumnLayout,
    resetColumnLayout,
    customizerLabels,
  } = useTasksColumnLayout();

  const { handleBulkDelete, handleBulkRestore, handleBulkStatusChange, isStatusPending } =
    useTasksBulkActions(selectedIds, onClearSelection);

  // The page header owns Create/Import/Export, so the toolbar gets no primary
  // action (a second Add button would duplicate chrome). The empty directory
  // still needs an in-context create affordance.
  const emptyAction = (
    <TasksEmptyCreateAction
      canWrite={canWrite}
      viewingDeleted={viewingDeleted}
      onAddNew={onAddNew}
    />
  );

  return (
    <div className="space-y-3">
      <TasksWorkToolbar
        quickFilter={quickFilter}
        quickFilterOptions={quickFilterOptions}
        onQuickFilterChange={setQuickFilter}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        shownCount={tasks.length}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        onClearPriority={() => setPriorityFilter([])}
        dueFrom={dueFrom}
        dueTo={dueTo}
        onDueRangeChange={({ start, end }) => {
          setDueFrom(start);
          setDueTo(end);
        }}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        activeChips={activeChips}
        trashToggle={
          onToggleTrash && canDelete
            ? {
                canViewDeleted: canDelete,
                viewingDeleted,
                onToggle: onToggleTrash,
                activeLabel: t("tasks.showActive"),
                deletedLabel: t("tasks.showDeleted"),
              }
            : undefined
        }
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        columnCustomizer={{
          registry: columnRegistry,
          onUpdate: updateUserColumnLayout,
          onReset: resetColumnLayout,
          labels: customizerLabels,
        }}
      />

      <TasksBulkActionBar
        selectedCount={selectedIds.length}
        viewingDeleted={viewingDeleted}
        canWrite={canWrite && !viewingDeleted}
        canComplete={canComplete}
        canDelete={canDelete}
        onClearSelection={onClearSelection}
        onRequestBulkDelete={handleBulkDelete}
        onRequestBulkRestore={handleBulkRestore}
        onBulkStatusChange={handleBulkStatusChange}
        statusPending={isStatusPending}
      />

      <TasksWorkDirectory
        viewMode={viewMode}
        tasks={tasks}
        selectedIds={selectedIds}
        viewingDeleted={viewingDeleted}
        canWrite={canWrite}
        canComplete={canComplete ?? canWrite}
        canDelete={canDelete}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        columnRegistry={columnRegistry}
        isColumnVisible={isColumnVisible}
        getColumnWidth={getColumnWidth}
        onColumnResize={setColumnWidth}
        onToggleSelected={onToggleSelected}
        onToggleSelectAll={onToggleSelectAll}
        onView={(task) => setViewingTaskId(task.id)}
        onEdit={onEdit}
        onDelete={onDelete}
        onRestore={onRestore}
        onUpdateStatus={onUpdateStatus}
        statusPending={statusPending}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        emptyAction={emptyAction}
      />

      <TasksPaginationFooter
        total={total}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />

      <TaskDetailDrawer
        task={viewingTask}
        parentTaskTitle={parentTask?.title}
        canWrite={canWrite && !viewingDeleted}
        canComplete={canComplete}
        pending={statusPending}
        canDelete={canDelete}
        onClose={() => setViewingTaskId(null)}
        onEdit={(task) => {
          setViewingTaskId(null);
          onEdit(task);
        }}
        onRestore={onRestore}
        onUpdateStatus={onUpdateStatus}
      />
    </div>
  );
}
