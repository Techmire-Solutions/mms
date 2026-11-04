import { useCallback, useState } from "react";
import {
  TASKS_MODULE_MANIFEST,
  tasksTransferSchema,
  type TaskInsert,
  type TaskRecord,
  type TaskStatus,
} from "@mms/shared";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { useWorkSelection } from "@/hooks/useWorkSelection";
import { useTranslation } from "@/hooks/useTranslation";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { notify } from "@/lib/notify";
import { useModulePermissions, usePermissions } from "@/tenant/hooks/usePermissions";
import {
  useCreateTask,
  useDeleteTask,
  useRestoreTask,
  useTaskMetrics,
  useTasks,
  useUpdateTask,
  useUpdateTaskStatus,
} from "@/tenant/hooks/collections/tasks";
import type { TaskServerFilters } from "@/tenant/features/tasks/lib/tasksServerFilters";

export const TASKS_PAGE_SIZE = 50;

export type TasksPageTab = "work" | "reports" | "setup";

/**
 * Tasks page controller — owns Work-tier state, permissions, the directory
 * query and every mutation so `TasksPage` stays a presentational shell
 * (same split as `useStudentsPageController` / `useContactsPageController`).
 */
export function useTasksPageController() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TasksPageTab>("work");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);
  const [viewingDeleted, setViewingDeleted] = useDirectoryTrashState();
  const [pageIndex, setPageIndex] = useState(0);
  const [serverFilters, setServerFilters] = useState<TaskServerFilters>({});
  const { selectedIds, toggleSelected, toggleSelectAll, clearSelection } =
    useWorkSelection<string>();

  const { can } = usePermissions();
  const { canRead, canWrite, canDelete, canEditSetup, canViewSetup } =
    useModulePermissions(TASKS_MODULE_MANIFEST);
  const canComplete = canWrite || can("tasks.complete");

  const { handleExport, isExporting } = useGenericModuleExport({
    path: "/api/tasks/export/csv",
    filename: "tasks.csv",
    auditPath: "/api/tasks/export-audit",
    columns: tasksTransferSchema.exportColumns,
    canExport: canRead,
  });

  const {
    data: tasksData,
    isLoading: tasksLoading,
    isError: tasksError,
    refetch: refetchTasks,
  } = useTasks({
    ...serverFilters,
    includeDeleted: viewingDeleted,
    limit: TASKS_PAGE_SIZE,
    offset: pageIndex * TASKS_PAGE_SIZE,
  });
  const { data: metrics } = useTaskMetrics({ enabled: !viewingDeleted });

  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const updateStatusMutation = useUpdateTaskStatus();
  const deleteTaskMutation = useDeleteTask();
  const restoreTaskMutation = useRestoreTask();

  const tasks = tasksData?.tasks ?? [];
  const totalTasks = tasksData?.total ?? 0;

  const handleOpenCreate = useCallback(() => {
    if (viewingDeleted) return;
    setEditingTask(null);
    setFormOpen(true);
  }, [viewingDeleted]);

  const handleOpenEdit = useCallback(
    (task: TaskRecord) => {
      if (viewingDeleted) return;
      setEditingTask(task);
      setFormOpen(true);
    },
    [viewingDeleted],
  );

  const handleCloseForm = useCallback(() => setFormOpen(false), []);

  const handleSave = async (data: TaskInsert) => {
    if (editingTask) {
      await updateTaskMutation.mutateAsync({
        id: editingTask.id,
        data,
        expectedUpdatedAt:
          typeof editingTask.updatedAt === "string" ? editingTask.updatedAt : undefined,
      });
    } else await createTaskMutation.mutateAsync(data);
  };

  const handleUpdateStatus = (id: string, status: TaskStatus) => {
    if (viewingDeleted) return;
    // Optimistic concurrency: echo the row's `updatedAt` so a concurrent edit is
    // a 409 instead of a silent overwrite. Missing row/token keeps legacy behavior.
    const task = tasks.find((row) => String(row.id) === id);
    const expectedUpdatedAt =
      typeof task?.updatedAt === "string"
        ? task.updatedAt
        : task?.updatedAt instanceof Date
          ? task.updatedAt.toISOString()
          : undefined;
    updateStatusMutation.mutate(
      { id, status, expectedUpdatedAt },
      {
        onError: (err) =>
          notify.error(err instanceof Error ? err.message : t("tasks.bulkStatusFailed")),
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteTaskMutation.mutate(id, {
      onSuccess: () => {
        notify.archivedWithUndo(t("common.recordArchived"), () => {
          void restoreTaskMutation.mutateAsync(id);
        });
      },
      onError: (err) => {
        notify.error(err instanceof Error ? err.message : t("tasks.deleteFailed"));
      },
    });
  };

  const handleRestore = (id: string) => {
    restoreTaskMutation.mutate(id, {
      onSuccess: () => notify.success(t("tasks.restored")),
      onError: (err) => {
        notify.error(err instanceof Error ? err.message : t("tasks.restoreFailed"));
      },
    });
  };

  const handleToggleTrash = useCallback(
    (next: boolean) => {
      setViewingDeleted(next);
      clearSelection();
    },
    [clearSelection, setViewingDeleted],
  );

  const handleServerFiltersChange = useCallback((filters: TaskServerFilters) => {
    setServerFilters(filters);
    setPageIndex(0);
  }, []);

  const handleRetry = useCallback(() => {
    void refetchTasks();
  }, [refetchTasks]);

  const pageTabs = [
    { id: "work" as const, label: t("nav.tasks") },
    ...(canRead ? [{ id: "reports" as const, label: t("module.reports") }] : []),
    ...(canViewSetup ? [{ id: "setup" as const, label: t("module.setup") }] : []),
  ];

  return {
    t,
    activeTab,
    setActiveTab,
    pageTabs,
    canRead,
    canWrite,
    canDelete,
    canEditSetup,
    canViewSetup,
    canComplete,
    viewingDeleted,
    handleToggleTrash,
    formOpen,
    editingTask,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseForm,
    handleSave,
    importOpen,
    setImportOpen,
    handleExport,
    isExporting,
    tasks,
    totalTasks,
    tasksLoading,
    tasksError,
    handleRetry,
    metrics,
    selectedIds,
    toggleSelected,
    toggleSelectAll,
    clearSelection,
    pageIndex,
    setPageIndex,
    pageSize: TASKS_PAGE_SIZE,
    handleServerFiltersChange,
    handleUpdateStatus,
    handleDelete,
    handleRestore,
  };
}

export type TasksPageController = ReturnType<typeof useTasksPageController>;
