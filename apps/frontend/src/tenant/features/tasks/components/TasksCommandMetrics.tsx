import React from "react";
import { AlertTriangle, CheckCircle2, Clock, Filter, ListChecks } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import type { TaskMetricsResponse } from "../hooks/useTasksApi";

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
      icon: ListChecks,
      label: t("tasks.metrics.total"),
      value: value(metrics?.total),
      accent: "primary" as const,
    },
    {
      icon: Filter,
      label: t("tasks.metrics.filtered"),
      value: shown,
      accent: "info" as const,
    },
    {
      icon: Clock,
      label: t("tasks.metrics.inProgress"),
      value: value(metrics?.inProgress),
      accent: "info" as const,
    },
    {
      icon: AlertTriangle,
      label: t("tasks.metrics.overdue"),
      value: value(metrics?.overdue),
      accent: "warning" as const,
    },
    {
      icon: CheckCircle2,
      label: t("tasks.metrics.completed"),
      value: value(metrics?.completed),
      accent: "success" as const,
    },
  ];

  return <ModuleCommandMetricsGrid items={items} />;
};
