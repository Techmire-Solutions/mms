/**
 * @file TasksWorkDirectory.tsx
 * @description Table/cards switch for Tasks Work directory.
 */

import React from "react";
import type { ModuleColumnRegistryEntry, TaskRecord, TaskStatus } from "@mms/shared";
import { ErrorState } from "@/components/app/ErrorState";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import { TasksListDesktopTable } from "./TasksListDesktopTable";
import { TasksListCards } from "./TasksListCards";

export interface TasksWorkDirectoryProps {
  viewMode: WorkDirectoryViewMode;
  tasks: TaskRecord[];
  selectedIds: string[];
  viewingDeleted: boolean;
  canWrite: boolean;
  canComplete?: boolean;
  statusPending?: boolean;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  canDelete: boolean;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  columnRegistry?: ModuleColumnRegistryEntry[];
  isColumnVisible: (key: string) => boolean;
  getColumnWidth: (key: string) => number | undefined;
  onColumnResize: (key: string, width: number) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean, visibleIds: string[]) => void;
  onView: (task: TaskRecord) => void;
  onEdit: (task: TaskRecord) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onUpdateStatus: (task: TaskRecord, status: TaskStatus) => void;
  emptyAction?: React.ReactNode;
}

export function TasksWorkDirectory({
  viewMode,
  tasks,
  selectedIds,
  viewingDeleted,
  canWrite,
  canComplete,
  statusPending = false,
  hasActiveFilters = false,
  onClearFilters,
  canDelete,
  isLoading,
  isError,
  onRetry,
  columnRegistry,
  isColumnVisible,
  getColumnWidth,
  onColumnResize,
  onToggleSelected,
  onToggleSelectAll,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onUpdateStatus,
  emptyAction,
}: TasksWorkDirectoryProps): React.JSX.Element {
  const { t } = useTranslation();
  const resolvedCanComplete = canComplete ?? canWrite;

  // A failed list must never masquerade as an empty directory: show the reason
  // and a retry instead of the empty state.
  if (isError) {
    return (
      <ErrorState
        title={t("tasks.loadFailed")}
        description={t("tasks.loadFailedHint")}
        onRetry={onRetry}
      />
    );
  }

  if (viewMode === "cards") {
    return (
      <TasksListCards
        tasks={tasks}
        selectedIds={selectedIds}
        viewingDeleted={viewingDeleted}
        canWrite={canWrite}
        canComplete={resolvedCanComplete}
        canDelete={canDelete}
        isLoading={isLoading}
        isColumnVisible={isColumnVisible}
        onToggleSelected={onToggleSelected}
        onToggleSelectAll={onToggleSelectAll}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onRestore={onRestore}
        onUpdateStatus={onUpdateStatus}
        statusPending={statusPending}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        emptyAction={emptyAction}
      />
    );
  }

  return (
    <TasksListDesktopTable
      tasks={tasks}
      selectedIds={selectedIds}
      viewingDeleted={viewingDeleted}
      canWrite={canWrite}
      canComplete={resolvedCanComplete}
      canDelete={canDelete}
      isLoading={isLoading}
      columnRegistry={columnRegistry}
      isColumnVisible={isColumnVisible}
      getColumnWidth={getColumnWidth}
      onColumnResize={onColumnResize}
      onToggleSelected={onToggleSelected}
      onToggleSelectAll={onToggleSelectAll}
      onView={onView}
      onEdit={onEdit}
      onDelete={onDelete}
      onRestore={onRestore}
      onUpdateStatus={onUpdateStatus}
      statusPending={statusPending}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      emptyAction={emptyAction}
    />
  );
}
