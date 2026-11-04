import { useCallback, useEffect, useState } from "react";
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
    columns: tasksTransferSchema.exportColumns,
    canExport: canRead,
    // The queue owns the authoritative audit row; the legacy client-counted
    // `/export-audit` row would duplicate and trust caller-supplied numbers.
    query: {
      ...serverFilters,
      ...(viewingDeleted ? { includeDeleted: true } : {}),
      ...(selectedIds.length > 0 ? { ids: selectedIds.join(",") } : {}),
    },
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
  const { mutate: mutateTaskStatus, isPending: statusPending } = useUpdateTaskStatus();
  const deleteTaskMutation = useDeleteTask();
  const restoreTaskMutation = useRestoreTask();
  const isSaving = createTaskMutation.isPending || updateTaskMutation.isPending;

  const tasks = tasksData?.tasks ?? [];
  const totalTasks = tasksData?.total ?? 0;

  // Delete side effects can leave the index past the last page. Only clamp once
  // data for the current key exists, otherwise a pending page fetch (data
  // undefined) would snap every page back to 0.
  const lastPage = tasksData ? Math.max(0, Math.ceil(tasksData.total / TASKS_PAGE_SIZE) - 1) : null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp after the page's own total arrives; deriving it for the query would require a second fetch.
    if (lastPage !== null && pageIndex > lastPage) setPageIndex(lastPage);
  }, [lastPage, pageIndex]);

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

  // The token travels with the row that was clicked. Looking it up through the
  // current `tasks` array here made the memoized table columns capture a
  // first-render closure with an empty list, silently disabling OCC.
  const handleUpdateStatus = useCallback(
    (task: TaskRecord, status: TaskStatus) => {
      if (viewingDeleted) return;
      const expectedUpdatedAt =
        typeof task.updatedAt === "string"
          ? task.updatedAt
          : task.updatedAt instanceof Date
            ? task.updatedAt.toISOString()
            : undefined;
      mutateTaskStatus(
        { id: task.id, status, expectedUpdatedAt },
        {
          onError: (err) =>
            notify.error(err instanceof Error ? err.message : t("tasks.bulkStatusFailed")),
        },
      );
    },
    [mutateTaskStatus, t, viewingDeleted],
  );

  const handleDelete = (id: string) => {
    deleteTaskMutation.mutate(id, {
      onSuccess: () => {
        notify.archivedWithUndo(t("common.recordArchived"), () => {
          void restoreTaskMutation.mutateAsync(id).catch((err: unknown) => {
            notify.error(err instanceof Error ? err.message : t("tasks.restoreFailed"));
          });
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
      setPageIndex(0);
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
    isSaving,
    statusPending,
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
