/**
 * Query key factories for Tasks module.
 */
export const TASKS_QUERY_KEY = ["tasks"] as const;

export const TASKS_LIST_QUERY_KEY = (query?: Record<string, unknown>) =>
  [...TASKS_QUERY_KEY, "list", query ?? {}] as const;

export const TASKS_METRICS_QUERY_KEY = [...TASKS_QUERY_KEY, "metrics"] as const;

export const TASK_DETAIL_QUERY_KEY = (id: string) => [...TASKS_QUERY_KEY, "detail", id] as const;

export const TASKS_ELIGIBLE_ASSIGNEES_QUERY_KEY = [
  ...TASKS_QUERY_KEY,
  "eligible-assignees",
] as const;

export const TASKS_SETTINGS_QUERY_KEY = [...TASKS_QUERY_KEY, "settings"] as const;
