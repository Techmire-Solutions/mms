/**
 * @file TasksListDesktopTable.tsx
 * @description WorkBatchTable desktop list for Tasks Work tier.
 */

import React, { useMemo } from "react";
import { Pencil, Trash2, RotateCcw } from "lucide-react";
import type { ModuleColumnRegistryEntry, TaskRecord, TaskStatus } from "@mms/shared";
import { WorkBatchTable } from "@/components/common/work/WorkBatchTable";
import { DataTableRowActions, resolveVisibleColumns } from "@/components/common/data-table";
import { ModuleTableFooterCount } from "@/components/app/ModuleTableFooterCount";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { getDirectoryPageSelection } from "@/lib/directorySelection";
import { buildTasksWorkBatchColumns } from "./tasksWorkBatchColumns";

export interface TasksListDesktopTableProps {
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
  columnRegistry?: ModuleColumnRegistryEntry[];
  isColumnVisible?: (key: string) => boolean;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean, visibleIds: string[]) => void;
  onView: (task: TaskRecord) => void;
  onEdit: (task: TaskRecord) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onUpdateStatus: (task: TaskRecord, status: TaskStatus) => void;
  emptyAction?: React.ReactNode;
}

export function TasksListDesktopTable({
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
}: TasksListDesktopTableProps): React.JSX.Element {
  const { t } = useTranslation();
  const pageIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const { allSelected, someSelected } = getDirectoryPageSelection(pageIds, selectedIds);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const baseColumns = useMemo(
    () =>
      buildTasksWorkBatchColumns(
        t,
        (canComplete ?? canWrite) && !viewingDeleted,
        onUpdateStatus,
        onView,
        statusPending,
        {
          isColumnVisible,
          getColumnWidth,
        },
      ),
    [
      t,
      canComplete,
      canWrite,
      viewingDeleted,
      onView,
      onUpdateStatus,
      statusPending,
      isColumnVisible,
      getColumnWidth,
    ],
  );

  const columns = useMemo(() => {
    if (!columnRegistry || columnRegistry.length === 0) return baseColumns;
    return resolveVisibleColumns(baseColumns, columnRegistry);
  }, [baseColumns, columnRegistry]);

  const pageCountLabel = formatDirectoryPageCountLabel(tasks.length, t, {
    singular: "tasks.singular",
    plural: "nav.tasks",
  });

  return (
    <>
      <WorkBatchTable
        data={tasks}
        columns={columns}
        isLoading={isLoading}
        stickyColumnId="title"
        columnResize={
          getColumnWidth || onColumnResize ? { getColumnWidth, onColumnResize } : undefined
        }
        selection={{
          selectedIds: selectedSet,
          onSelectOne: (id) => onToggleSelected(id, !selectedSet.has(id)),
          onSelectAll: () => onToggleSelectAll(!allSelected, pageIds),
          allSelected,
          someSelected,
          selectAllAriaLabel: allSelected ? t("common.deselect") : t("common.selectAll"),
          selectRowAriaLabel: (task) => task.title,
        }}
        onRowClick={onView}
        renderRowActions={(task) => {
          const actions = [];
          if (viewingDeleted && canDelete && onRestore) {
            actions.push({
              id: "restore",
              label: t("tasks.restore"),
              icon: RotateCcw,
              onClick: () => onRestore(task.id),
            });
          } else {
            if (canWrite) {
              actions.push({
                id: "edit",
                label: t("common.edit"),
                icon: Pencil,
                onClick: () => onEdit(task),
              });
            }
            if (canDelete) {
              actions.push({
                id: "delete",
                label: t("common.delete"),
                icon: Trash2,
                tone: "destructive" as const,
                onClick: () => onDelete(task.id),
              });
            }
          }
          return actions.length > 0 ? <DataTableRowActions actions={actions} /> : null;
        }}
        emptyState={
          hasActiveFilters ? (
            <EmptyState
              title={t("common.dataTable.noMatches")}
              action={
                onClearFilters ? (
                  <Button variant="outline" onClick={onClearFilters}>
                    {t("common.clearFilters")}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <EmptyState
              title={viewingDeleted ? t("tasks.trashEmptyTitle") : t("tasks.emptyTitle")}
              description={
                viewingDeleted ? t("tasks.trashEmptyDescription") : t("tasks.emptyDescription")
              }
              action={!viewingDeleted ? emptyAction : undefined}
            />
          )
        }
      />
      <ModuleTableFooterCount
        selectedCount={selectedIds.length}
        selectedCountLabel={t("tasks.selectedCount", { count: selectedIds.length })}
        pageCountLabel={pageCountLabel}
      />
    </>
  );
}
