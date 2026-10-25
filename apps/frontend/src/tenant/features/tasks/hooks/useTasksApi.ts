import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type TaskRecord,
  type TaskListQuery,
  type TaskInsert,
  type TaskUpdate,
  type TaskStatus,
  type TaskSettings,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import {
  TASKS_QUERY_KEY,
  TASKS_LIST_QUERY_KEY,
  TASKS_METRICS_QUERY_KEY,
  TASK_DETAIL_QUERY_KEY,
  TASKS_ELIGIBLE_ASSIGNEES_QUERY_KEY,
  TASKS_SETTINGS_QUERY_KEY,
} from "./tasksQueryKeys";

export interface TasksListResponse {
  tasks: TaskRecord[];
  total: number;
}

export interface TaskMetricsResponse {
  total: number;
  todo: number;
  inProgress: number;
  inReview: number;
  blocked: number;
  completed: number;
  cancelled: number;
  overdue: number;
  byPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
}

/** Throws on any non-2xx (create returns 201, so this must accept the whole 2xx range). */
function assertOk(response: { status: number; body: unknown }, context: string): void {
  if (response.status >= 200 && response.status < 300) return;
  const errorBody = response.body as { message?: string; type?: string } | undefined;
  throw new ApiError(response.status, errorBody?.message ?? context, errorBody?.type);
}

export function invalidateTasksQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
}

export function useTasks(query?: Partial<TaskListQuery>, options: { enabled?: boolean } = {}) {
  const queryParams = {
    ...(query?.status ? { status: query.status } : {}),
    ...(query?.priority ? { priority: query.priority } : {}),
    ...(query?.assignedToFacultyId ? { assignedToFacultyId: query.assignedToFacultyId } : {}),
    ...(query?.assignedToUserId ? { assignedToUserId: query.assignedToUserId } : {}),
    ...(query?.createdById ? { createdById: query.createdById } : {}),
    ...(query?.search ? { search: query.search } : {}),
    ...(query?.includeDeleted ? { includeDeleted: true } : {}),
    ...(query?.limit ? { limit: query.limit } : {}),
    ...(query?.offset ? { offset: query.offset } : {}),
  };

  return useQuery({
    queryKey: TASKS_LIST_QUERY_KEY(query as Record<string, unknown>),
    queryFn: async ({ signal }) => {
      const response = await apiContract.tasks.list({
        query: queryParams,
        signal,
        fetchOptions: { signal },
      });
      assertOk(response, "Failed to load tasks");
      return response.body as TasksListResponse;
    },
    enabled: options.enabled ?? true,
    staleTime: 15_000,
  });
}

export function useTaskMetrics(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: TASKS_METRICS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.tasks.metrics({ signal, fetchOptions: { signal } });
      assertOk(response, "Failed to load task metrics");
      return response.body as TaskMetricsResponse;
    },
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useTask(id: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: TASK_DETAIL_QUERY_KEY(id),
    queryFn: async ({ signal }) => {
      const response = await apiContract.tasks.get({
        params: { id },
        signal,
        fetchOptions: { signal },
      });
      assertOk(response, "Failed to load task");
      return response.body as TaskRecord;
    },
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 15_000,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TaskInsert) => {
      const response = await apiContract.tasks.create({ body: data });
      assertOk(response, "Failed to create task");
      return response.body as TaskRecord;
    },
    onSuccess: () => {
      void invalidateTasksQueries(queryClient);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TaskUpdate }) => {
      const response = await apiContract.tasks.update({ params: { id }, body: data });
      assertOk(response, "Failed to update task");
      return response.body as TaskRecord;
    },
    onSuccess: (_data, variables) => {
      void invalidateTasksQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: TASK_DETAIL_QUERY_KEY(variables.id) });
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const response = await apiContract.tasks.updateStatus({ params: { id }, body: { status } });
      assertOk(response, "Failed to update task status");
      return response.body as TaskRecord;
    },
    onSuccess: (_data, variables) => {
      void invalidateTasksQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: TASK_DETAIL_QUERY_KEY(variables.id) });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiContract.tasks.remove({ params: { id } });
      assertOk(response, "Failed to delete task");
      return response.body as { success: boolean };
    },
    onSuccess: () => {
      void invalidateTasksQueries(queryClient);
    },
  });
}

export function useRestoreTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiContract.tasks.restore({ params: { id } });
      assertOk(response, "Failed to restore task");
      return response.body as { success: boolean; task: TaskRecord };
    },
    onSuccess: () => {
      void invalidateTasksQueries(queryClient);
    },
  });
}

export function useBulkDeleteTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await apiContract.tasks.bulkDelete({ body: { ids } });
      assertOk(response, "Failed to bulk delete tasks");
      return response.body as { deletedIds: string[] };
    },
    onSuccess: () => {
      void invalidateTasksQueries(queryClient);
    },
  });
}

export function useBulkRestoreTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await apiContract.tasks.bulkRestore({ body: { ids } });
      assertOk(response, "Failed to bulk restore tasks");
      return response.body as { restoredIds: string[] };
    },
    onSuccess: () => {
      void invalidateTasksQueries(queryClient);
    },
  });
}

export interface EligibleAssigneeItem {
  facultyId: string;
  name: string;
  employeeId?: string | null;
  assignmentId?: string | null;
  departmentName?: string | null;
  userId: string;
  isSelf: boolean;
}

export function useEligibleTaskAssignees(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: TASKS_ELIGIBLE_ASSIGNEES_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.tasks.eligibleAssignees({
        signal,
        fetchOptions: { signal },
      });
      assertOk(response, "Failed to load eligible assignees");
      return response.body as EligibleAssigneeItem[];
    },
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useTaskSettings(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: TASKS_SETTINGS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.tasks.getSettings({ signal, fetchOptions: { signal } });
      assertOk(response, "Failed to load task settings");
      return response.body as TaskSettings;
    },
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useUpdateTaskSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: TaskSettings) => {
      const response = await apiContract.tasks.updateSettings({ body: settings });
      assertOk(response, "Failed to update task settings");
      return response.body as TaskSettings;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TASKS_SETTINGS_QUERY_KEY });
    },
  });
}
