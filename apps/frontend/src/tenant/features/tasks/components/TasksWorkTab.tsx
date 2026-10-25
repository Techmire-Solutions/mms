/**
 * @file TasksWorkTab.tsx
 * @description Tasks Work tier — toolbar, selection, directory, detail drawer.
 */

import React, { useMemo, useState } from "react";
import { TASK_STATUSES, type TaskRecord, type TaskStatus } from "@mms/shared";
import { WorkTaskToolbar } from "@/components/common/work/WorkTaskToolbar";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { useBulkDeleteTasks, useBulkRestoreTasks } from "@/tenant/hooks/collections/tasks";
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
}: TasksWorkTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
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

  const bulkDeleteMutation = useBulkDeleteTasks();
  const bulkRestoreMutation = useBulkRestoreTasks();

  const handleBulkDelete = () => {
    if (!selectedIds.length) return;
    const targets = [...selectedIds];
    bulkDeleteMutation.mutate(targets, {
      onSuccess: ({ deletedIds }) => {
        onClearSelection();
        notify.archivedWithUndo(t("common.recordArchived"), () => {
          void bulkRestoreMutation.mutateAsync(deletedIds);
        });
      },
      onError: (err) => {
        notify.error(err instanceof Error ? err.message : t("tasks.deleteFailed"));
      },
    });
  };

  const handleBulkRestore = () => {
    if (!selectedIds.length) return;
    const targets = [...selectedIds];
    bulkRestoreMutation.mutate(targets, {
      onSuccess: () => {
        onClearSelection();
        notify.success(t("tasks.restored"));
      },
      onError: (err) => {
        notify.error(err instanceof Error ? err.message : t("tasks.restoreFailed"));
      },
    });
  };

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter.length > 0 && !statusFilter.includes(task.status)) return false;
      if (!q) return true;
      const haystack = `${task.title} ${task.description ?? ""} ${
        task.assignees?.map((a) => a.facultyName).join(" ") ?? ""
      }`.toLowerCase();
      return haystack.includes(q);
    });
  }, [tasks, search, statusFilter]);

  const primaryAction = undefined;

  return (
    <div className="space-y-3">
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
        canDelete={canDelete}
        onClearSelection={onClearSelection}
        onRequestBulkDelete={handleBulkDelete}
        onRequestBulkRestore={handleBulkRestore}
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

      <TaskDetailDrawer
        task={viewingTask}
        canWrite={canWrite && !viewingDeleted}
        canDelete={canDelete}
        onClose={() => setViewingTask(null)}
        onEdit={(task) => {
          setViewingTask(null);
          onEdit(task);
        }}
        onRestore={onRestore}
      />
    </div>
  );
}
