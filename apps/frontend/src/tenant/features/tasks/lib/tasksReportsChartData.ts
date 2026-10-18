/**
 * @file tasksReportsChartData.ts
 * @description Pure mappers from task metrics to Recharts series payloads.
 */

export interface TaskMetricsChartSource {
  total: number;
  todo: number;
  inProgress: number;
  inReview: number;
  blocked: number;
  completed: number;
  cancelled: number;
  overdue: number;
  byPriority?: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
}

export interface TasksChartDatum {
  name: string;
  value: number;
}

const EMPTY_PRIORITY = { low: 0, medium: 0, high: 0, urgent: 0 } as const;

/** Status pie/bar series from command-centre metrics. */
export function buildTasksStatusChartData(
  metrics: TaskMetricsChartSource,
  labels: {
    todo: string;
    inProgress: string;
    inReview: string;
    blocked: string;
    completed: string;
    cancelled: string;
  },
): TasksChartDatum[] {
  return [
    { name: labels.todo, value: metrics.todo },
    { name: labels.inProgress, value: metrics.inProgress },
    { name: labels.inReview, value: metrics.inReview },
    { name: labels.blocked, value: metrics.blocked },
    { name: labels.completed, value: metrics.completed },
    { name: labels.cancelled, value: metrics.cancelled },
  ];
}

/** Priority bar series from metrics.byPriority. */
export function buildTasksPriorityChartData(
  metrics: TaskMetricsChartSource,
  labels: { low: string; medium: string; high: string; urgent: string },
): TasksChartDatum[] {
  const byPriority = metrics.byPriority ?? EMPTY_PRIORITY;
  return [
    { name: labels.low, value: byPriority.low },
    { name: labels.medium, value: byPriority.medium },
    { name: labels.high, value: byPriority.high },
    { name: labels.urgent, value: byPriority.urgent },
  ];
}

/** Overdue vs remaining (non-overdue) comparison series. */
export function buildTasksOverdueChartData(
  metrics: TaskMetricsChartSource,
  labels: { overdue: string; onTrack: string },
): TasksChartDatum[] {
  const onTrack = Math.max(0, metrics.total - metrics.overdue);
  return [
    { name: labels.overdue, value: metrics.overdue },
    { name: labels.onTrack, value: onTrack },
  ];
}

export function hasChartValues(data: readonly TasksChartDatum[]): boolean {
  return data.some((d) => d.value > 0);
}
