/**
 * @file TasksWorkTab.tsx
 * @description Tasks Work tier — toolbar, selection, directory, detail drawer.
 */

import React, { useState } from "react";
import { TASK_STATUSES, TASK_PRIORITIES, type TaskRecord, type TaskStatus } from "@mms/shared";
import {
  ModuleFilterDropdown,
  ModuleFilterCheckboxGroup,
} from "@/components/app/ModuleFiltersMenuButton";
import { FilterChips } from "@/components/app/FilterChips";
import { CompactSegmentedControl } from "@/components/app/CompactSegmentedControl";
import { useTasksWorkTabFilters, type TaskQuickFilter } from "../hooks/useTasksWorkTabFilters";
import { useTaskSelectionScope } from "../hooks/useTaskSelectionScope";
import { buildTaskFilterScopeKey } from "../lib/taskFilterScope";
import type { TaskServerFilters } from "../lib/tasksServerFilters";
import { useTaskServerFiltersSync } from "../hooks/useTaskServerFiltersSync";
import { useTasksBulkActions } from "../hooks/useTasksBulkActions";
import { TasksPaginationFooter } from "./TasksPaginationFooter";
import { WorkTaskToolbar } from "@/components/common/work/WorkTaskToolbar";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import { useTasksColumnLayout } from "../hooks/useTasksColumnLayout";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { TasksBulkActionBar } from "./TasksBulkActionBar";
import { TasksWorkDirectory } from "./TasksWorkDirectory";

export interface TasksWorkTabProps {
  tasks: TaskRecord[];
  isLoading: boolean;
  canWrite: boolean;
  canComplete?: boolean;
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
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  total: number;
  pageIndex: number;
  pageSize: number;
  onPageChange: (pageIndex: number) => void;
  onServerFiltersChange: (filters: TaskServerFilters) => void;
}

export function TasksWorkTab({
  tasks,
  isLoading,
  canWrite,
  canComplete,
  canDelete,
  viewingDeleted = false,
  selectedIds,
  onToggleSelected,
  onToggleSelectAll,
  onClearSelection,
  onToggleTrash,
  onAddNew: _onAddNew,
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
    setSearch,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    dueFrom,
    setDueFrom,
    dueTo,
    setDueTo,
    filteredTasks,
    activeChips,
    handleClearFilters,
  } = useTasksWorkTabFilters(tasks);

  useTaskServerFiltersSync(
    { quickFilter, search, statusFilter, priorityFilter, dueFrom, dueTo },
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
  const [viewingTask, setViewingTask] = useState<TaskRecord | null>(null);
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

  const primaryAction = undefined;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-0.5">
        <CompactSegmentedControl<TaskQuickFilter>
          value={quickFilter}
          onChange={setQuickFilter}
          options={quickFilterOptions}
        />
      </div>

      <WorkTaskToolbar
        regionLabel={t("nav.tasks")}
        shownCountLabel={t("tasks.shownCount", { count: filteredTasks.length })}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("tasks.searchPlaceholder")}
        statusFilter={{
          activeIds: statusFilter,
          options: TASK_STATUSES.map((status) => ({
            id: status,
            label: t(`tasks.status.${status}`),
          })),
          onToggle: (id) =>
            setStatusFilter((current) =>
              current.includes(id) ? current.filter((s) => s !== id) : [...current, id],
            ),
          allLabel: t("common.all"),
          onResetAll: () => setStatusFilter([]),
        }}
        dateRange={{
          startDate: dueFrom,
          endDate: dueTo,
          onDateRangeChange: ({ start, end }) => {
            setDueFrom(start);
            setDueTo(end);
          },
          startPlaceholder: t("tasks.dateFrom"),
          endPlaceholder: t("tasks.dateTo"),
        }}
        filterButton={
          <ModuleFilterDropdown
            label={t("common.filters")}
            activeCount={priorityFilter.length}
            clearLabel={t("common.clearFilters")}
            onClear={() => setPriorityFilter([])}
          >
            <ModuleFilterCheckboxGroup
              label={t("tasks.priority")}
              options={TASK_PRIORITIES.map((priority) => ({
                value: priority,
                label: t(`tasks.priority.${priority}` as Parameters<typeof t>[0]),
              }))}
              selected={priorityFilter}
              onToggle={(value) =>
                setPriorityFilter((current) =>
                  current.includes(value)
                    ? current.filter((p) => p !== value)
                    : [...current, value],
                )
              }
            />
          </ModuleFilterDropdown>
        }
        hasActiveFilters={activeChips.length > 0}
        onClearFilters={handleClearFilters}
        clearFiltersLabel={t("common.clearFilters")}
        filterChips={<FilterChips chips={activeChips} onClearAll={handleClearFilters} />}
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
        viewModeToggle={{ viewMode, onViewModeChange: setViewMode }}
        columnCustomizer={{
          registry: columnRegistry,
          onUpdate: updateUserColumnLayout,
          onReset: resetColumnLayout,
          labels: customizerLabels,
        }}
        primaryAction={primaryAction}
      />

      <TasksBulkActionBar
        selectedCount={selectedIds.length}
        viewingDeleted={viewingDeleted}
        canWrite={canWrite && !viewingDeleted}
        canDelete={canDelete}
        onClearSelection={onClearSelection}
        onRequestBulkDelete={handleBulkDelete}
        onRequestBulkRestore={handleBulkRestore}
        onBulkStatusChange={handleBulkStatusChange}
        statusPending={isStatusPending}
      />

      <TasksWorkDirectory
        viewMode={viewMode}
        tasks={filteredTasks}
        selectedIds={selectedIds}
        viewingDeleted={viewingDeleted}
        canWrite={canWrite}
        canComplete={canComplete ?? canWrite}
        canDelete={canDelete}
        isLoading={isLoading}
        columnRegistry={columnRegistry}
        isColumnVisible={isColumnVisible}
        getColumnWidth={getColumnWidth}
        onColumnResize={setColumnWidth}
        onToggleSelected={onToggleSelected}
        onToggleSelectAll={onToggleSelectAll}
        onView={setViewingTask}
        onEdit={onEdit}
        onDelete={onDelete}
        onRestore={onRestore}
        onUpdateStatus={onUpdateStatus}
        emptyAction={primaryAction}
      />

      <TasksPaginationFooter
        total={total}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />

      <TaskDetailDrawer
        task={viewingTask}
        canWrite={canWrite && !viewingDeleted}
        canComplete={canComplete}
        canDelete={canDelete}
        onClose={() => setViewingTask(null)}
        onEdit={(task) => {
          setViewingTask(null);
          onEdit(task);
        }}
        onRestore={onRestore}
        onUpdateStatus={onUpdateStatus}
      />
    </div>
  );
}
