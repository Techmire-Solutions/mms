/**
 * @file TasksReportsCharts.tsx
 * @description Recharts status / priority / overdue series for Tasks Reports.
 */

import React from "react";
import { BarChart2 } from "lucide-react";
import { Bar, BarChart, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { chartAxisTick } from "@/components/ui/ChartGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReportChartCard } from "@/tenant/components/moduleReports";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { useTranslation } from "@/hooks/useTranslation";
import type { TaskMetricsResponse } from "@/tenant/features/tasks/hooks/useTasksApi";
import {
  buildTasksOverdueChartData,
  buildTasksPriorityChartData,
  buildTasksStatusChartData,
  hasChartValues,
} from "./tasksReportsChartData";

interface TasksReportsChartsProps {
  metrics: TaskMetricsResponse;
}

export function TasksReportsCharts({ metrics }: TasksReportsChartsProps): React.JSX.Element {
  const { t } = useTranslation();
  const palette = useBrandPalette();
  const colors = [
    palette.primary,
    palette.secondary,
    palette.charts[0],
    palette.charts[1],
    palette.charts[2],
    palette.charts[3],
  ];

  const statusData = buildTasksStatusChartData(metrics, {
    todo: t("tasks.status.todo"),
    inProgress: t("tasks.status.in_progress"),
    inReview: t("tasks.status.in_review"),
    blocked: t("tasks.status.blocked"),
    completed: t("tasks.status.completed"),
    cancelled: t("tasks.status.cancelled"),
  });
  const priorityData = buildTasksPriorityChartData(metrics, {
    low: t("tasks.priority.low"),
    medium: t("tasks.priority.medium"),
    high: t("tasks.priority.high"),
    urgent: t("tasks.priority.urgent"),
  });
  const overdueData = buildTasksOverdueChartData(metrics, {
    overdue: t("tasks.metrics.overdue"),
    onTrack: t("tasks.reports.onTrack"),
  });

  const emptyNode = (
    <EmptyState title={t("tasks.reports.noData")} compact icon={BarChart2} className="h-chart-md" />
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <ReportChartCard
        title={t("tasks.reports.statusDistribution")}
        accentColor="primary"
        heightClass="h-chart-md"
        empty={!hasChartValues(statusData)}
        emptyNode={emptyNode}
      >
        <PieChart>
          <Pie
            data={statusData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={70}
            paddingAngle={3}
          >
            {statusData.map((row, index) => (
              <Cell key={row.name} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
        </PieChart>
      </ReportChartCard>

      <ReportChartCard
        title={t("tasks.reports.priorityDistribution")}
        accentColor="info"
        heightClass="h-chart-md"
        empty={!hasChartValues(priorityData)}
        emptyNode={emptyNode}
      >
        <BarChart data={priorityData} barSize={20}>
          <XAxis dataKey="name" tick={chartAxisTick(10)} tickLine={false} />
          <YAxis allowDecimals={false} tick={chartAxisTick(10)} tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {priorityData.map((row, index) => (
              <Cell key={row.name} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ReportChartCard>

      <ReportChartCard
        title={t("tasks.reports.overdueBreakdown")}
        accentColor="warning"
        heightClass="h-chart-md"
        empty={!hasChartValues(overdueData)}
        emptyNode={emptyNode}
      >
        <BarChart data={overdueData} barSize={28}>
          <XAxis dataKey="name" tick={chartAxisTick(10)} tickLine={false} />
          <YAxis allowDecimals={false} tick={chartAxisTick(10)} tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            <Cell fill="hsl(var(--destructive))" />
            <Cell fill="hsl(var(--success))" />
          </Bar>
        </BarChart>
      </ReportChartCard>
    </div>
  );
}
