/**
 * @file TasksReportsTab.tsx
 * @description Tasks Reports tier — KPI cards, Recharts series, and execution health.
 */

import React from "react";
import { CheckCircle2, Clock, AlertTriangle, RotateCcw, ListTodo, TrendingUp } from "lucide-react";
import { useTaskMetrics } from "@/tenant/features/tasks/hooks/useTasksApi";
import { StatsSkeleton } from "@shared/ui";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import { useTranslation } from "@/hooks/useTranslation";
import { TasksReportsCharts } from "./TasksReportsCharts";

export function TasksReportsTab(): React.JSX.Element {
  const { t } = useTranslation();
  const { data: metrics, isLoading } = useTaskMetrics();

  if (isLoading) {
    return <StatsSkeleton count={6} />;
  }

  const m = metrics ?? {
    total: 0,
    todo: 0,
    inProgress: 0,
    inReview: 0,
    blocked: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0,
    byPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
  };

  const completionRate = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
  const onTimeRate =
    m.total > 0 ? Math.max(0, Math.round(((m.total - m.overdue) / m.total) * 100)) : 100;

  return (
    <div className="space-y-6">
      <ModuleCommandMetricsGrid
        items={[
          {
            key: "total",
            label: t("tasks.metrics.total"),
            value: m.total,
            icon: ListTodo,
            accent: "primary",
          },
          {
            key: "inProgress",
            label: t("tasks.metrics.inProgress"),
            value: m.inProgress,
            icon: Clock,
            accent: "warning",
          },
          {
            key: "completed",
            label: t("tasks.metrics.completed"),
            value: m.completed,
            icon: CheckCircle2,
            accent: "success",
          },
          {
            key: "blocked",
            label: t("tasks.metrics.blocked"),
            value: m.blocked,
            icon: AlertTriangle,
            accent: "destructive",
          },
          {
            key: "overdue",
            label: t("tasks.metrics.overdue"),
            value: m.overdue,
            icon: RotateCcw,
            accent: "destructive",
          },
          {
            key: "completionRate",
            label: t("tasks.metrics.completionRate"),
            value: `${completionRate}%`,
            icon: TrendingUp,
            accent: "primary",
          },
        ]}
      />

      <TasksReportsCharts metrics={m} />

      <div className="rounded-lg border border-border bg-card p-5 shadow-xs space-y-4">
        <div>
          <h3 className="font-semibold text-sm text-foreground mb-1">
            {t("tasks.reports.executionHealth")}
          </h3>
          <p className="text-xs text-muted-foreground text-wrap-pretty">
            {t("tasks.reports.executionHealthHint")}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 border border-border/50">
            <span className="text-xs font-medium text-foreground">{t("tasks.reports.onTime")}</span>
            <span className="text-sm font-bold text-success">{onTimeRate}%</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 border border-border/50">
            <span className="text-xs font-medium text-foreground">
              {t("tasks.metrics.blocked")}
            </span>
            <span
              className={`text-sm font-bold ${
                m.blocked > 0 ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {t("tasks.reports.blockedCount", { count: m.blocked })}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 border border-border/50">
            <span className="text-xs font-medium text-foreground">
              {t("tasks.reports.activeWorkload")}
            </span>
            <span className="text-sm font-bold text-primary">
              {t("tasks.reports.inFlight", { count: m.inProgress + m.inReview })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
