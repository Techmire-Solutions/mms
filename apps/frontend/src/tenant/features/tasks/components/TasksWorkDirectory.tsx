/**
 * @file TasksWorkDirectory.tsx
 * @description Table/cards switch for Tasks Work directory.
 */

import React from "react";
import type { ModuleColumnRegistryEntry, TaskRecord, TaskStatus } from "@mms/shared";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { TasksListDesktopTable } from "./TasksListDesktopTable";
import { TasksListCards } from "./TasksListCards";

export interface TasksWorkDirectoryProps {
  viewMode: WorkDirectoryViewMode;
  tasks: TaskRecord[];
  selectedIds: string[];
  viewingDeleted: boolean;
  canWrite: boolean;
  canComplete?: boolean;
  canDelete: boolean;
  isLoading: boolean;
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
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  emptyAction?: React.ReactNode;
}

export function TasksWorkDirectory({
  viewMode,
  tasks,
  selectedIds,
  viewingDeleted,
  canWrite,
  canComplete,
  canDelete,
  isLoading,
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
  const resolvedCanComplete = canComplete ?? canWrite;

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
      emptyAction={emptyAction}
    />
  );
}
