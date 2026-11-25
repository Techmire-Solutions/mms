/**
 * Cross-module public surface for Tasks Query hooks.
 * Other features and shared UI must import from here — not `@/tenant/features/tasks/hooks/*`.
 */
export {
  TASKS_QUERY_KEY,
  TASKS_LIST_QUERY_KEY,
  TASKS_METRICS_QUERY_KEY,
  TASK_DETAIL_QUERY_KEY,
} from "@/tenant/features/tasks/hooks/tasksQueryKeys";

export {
  useTasks,
  useTaskMetrics,
  useTask,
  useCreateTask,
  useUpdateTask,
  useUpdateTaskStatus,
  useDeleteTask,
  useRestoreTask,
  useBulkDeleteTasks,
  useBulkRestoreTasks,
  useBulkUpdateTaskStatus,
  useEligibleTaskAssignees,
  useTaskSettings,
  useUpdateTaskSettings,
  invalidateTasksQueries,
  type TasksListResponse,
  type TaskMetricsResponse,
  type EligibleAssigneeItem,
} from "@/tenant/features/tasks/hooks/useTasksApi";
