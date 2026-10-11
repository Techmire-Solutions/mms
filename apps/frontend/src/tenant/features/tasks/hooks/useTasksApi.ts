import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type TaskRecord,
  type TaskListQuery,
  type TaskInsert,
  type TaskUpdate,
  type TaskStatus,
  type TaskSettings,
} from "@mms/shared";
import { apiJson } from "@/lib/apiClient";
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

export function invalidateTasksQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
}

export function useTasks(query?: Partial<TaskListQuery>, options: { enabled?: boolean } = {}) {
  const queryParams = new URLSearchParams();
  if (query) {
    if (query.status) queryParams.set("status", query.status);
    if (query.priority) queryParams.set("priority", query.priority);
    if (query.assignedToFacultyId)
      queryParams.set("assignedToFacultyId", query.assignedToFacultyId);
    if (query.assignedToUserId) queryParams.set("assignedToUserId", query.assignedToUserId);
    if (query.createdById) queryParams.set("createdById", query.createdById);
    if (query.search) queryParams.set("search", query.search);
    if (query.includeDeleted) queryParams.set("includeDeleted", "true");
    if (query.limit) queryParams.set("limit", String(query.limit));
    if (query.offset) queryParams.set("offset", String(query.offset));
  }
  const queryString = queryParams.toString();
  const url = queryString ? `/api/tasks?${queryString}` : "/api/tasks";

  return useQuery({
    queryKey: TASKS_LIST_QUERY_KEY(query as Record<string, unknown>),
    queryFn: ({ signal }) => apiJson<TasksListResponse>(url, { signal }),
    enabled: options.enabled ?? true,
    staleTime: 15_000,
  });
}

export function useTaskMetrics(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: TASKS_METRICS_QUERY_KEY,
    queryFn: ({ signal }) => apiJson<TaskMetricsResponse>("/api/tasks/metrics", { signal }),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useTask(id: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: TASK_DETAIL_QUERY_KEY(id),
    queryFn: ({ signal }) => apiJson<TaskRecord>(`/api/tasks/${id}`, { signal }),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 15_000,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TaskInsert) =>
      apiJson<TaskRecord>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void invalidateTasksQueries(queryClient);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TaskUpdate }) =>
      apiJson<TaskRecord>(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      void invalidateTasksQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: TASK_DETAIL_QUERY_KEY(variables.id) });
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      apiJson<TaskRecord>(`/api/tasks/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_data, variables) => {
      void invalidateTasksQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: TASK_DETAIL_QUERY_KEY(variables.id) });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiJson<{ success: boolean }>(`/api/tasks/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void invalidateTasksQueries(queryClient);
    },
  });
}

export function useRestoreTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiJson<{ success: boolean; task: TaskRecord }>(`/api/tasks/${id}/restore`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
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
    queryFn: ({ signal }) =>
      apiJson<EligibleAssigneeItem[]>("/api/tasks/eligible-assignees", { signal }),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useTaskSettings(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: TASKS_SETTINGS_QUERY_KEY,
    queryFn: ({ signal }) => apiJson<TaskSettings>("/api/tasks/settings", { signal }),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useUpdateTaskSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: TaskSettings) =>
      apiJson<TaskSettings>("/api/tasks/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TASKS_SETTINGS_QUERY_KEY });
    },
  });
}
