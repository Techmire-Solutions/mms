import React from "react";
import { Filter } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import type { TaskMetricsResponse } from "../hooks/useTasksApi";
import { TASK_METRIC_UI } from "../lib/taskMetricUi";

export interface TasksCommandMetricsProps {
  /** Server task metrics (`useTaskMetrics`); `undefined` until the query settles. */
  metrics?: TaskMetricsResponse;
  /** Filtered directory total — the pagination footer's `total`. */
  shown: number;
}

/**
 * Work-tier command KPI strip (standard `ModuleCommandMetricsGrid` contract,
 * matching Faculty/Contacts/Students). Renders "—" until the metrics query
 * settles so the command centre never flashes a false 0.
 */
export const TasksCommandMetrics = function TasksCommandMetrics({
  metrics,
  shown,
}: TasksCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();
  const value = (n: number | undefined): string | number => (metrics ? (n ?? 0) : "—");

  const items = [
    {
      icon: TASK_METRIC_UI.total.icon,
      label: t("tasks.metrics.total"),
      value: value(metrics?.total),
      accent: TASK_METRIC_UI.total.accent,
    },
    {
      icon: Filter,
      label: t("tasks.metrics.filtered"),
      value: shown,
      accent: "info" as const,
    },
    {
      icon: TASK_METRIC_UI.inProgress.icon,
      label: t("tasks.metrics.inProgress"),
      value: value(metrics?.inProgress),
      accent: TASK_METRIC_UI.inProgress.accent,
    },
    {
      icon: TASK_METRIC_UI.blocked.icon,
      label: t("tasks.metrics.blocked"),
      value: value(metrics?.blocked),
      accent: TASK_METRIC_UI.blocked.accent,
    },
    {
      icon: TASK_METRIC_UI.overdue.icon,
      label: t("tasks.metrics.overdue"),
      value: value(metrics?.overdue),
      accent: TASK_METRIC_UI.overdue.accent,
    },
    {
      icon: TASK_METRIC_UI.completed.icon,
      label: t("tasks.metrics.completed"),
      value: value(metrics?.completed),
      accent: TASK_METRIC_UI.completed.accent,
    },
  ];

  return <ModuleCommandMetricsGrid items={items} />;
};
