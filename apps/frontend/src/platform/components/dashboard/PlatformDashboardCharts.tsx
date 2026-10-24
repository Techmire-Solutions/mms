import { ChartAreaGradient } from "@/components/dashboard-widgets/charts/chartPrimitives";
import { PlatformCountTooltip } from "@/platform/components/reports/platformChartTooltips";
import React, { useId } from "react";
import { TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { useTranslation } from "@/hooks/useTranslation";
import { ReportChartCard } from "@/components/reports/ReportChartCard";
import { WidgetCard, WidgetCardHeader } from "@shared/ui";
import { usePlatformActivityTrend } from "@/platform/hooks/usePlatformTelemetry";

export interface PlatformDashboardChartsProps {
  activeWorkspaces: number;
  disabledWorkspaces: number;
}

export function PlatformDashboardCharts({
  activeWorkspaces,
  disabledWorkspaces,
}: PlatformDashboardChartsProps): React.JSX.Element {
  const { t } = useTranslation();
  const gradientId = useId();
  const { data: activityTrend } = usePlatformActivityTrend();

  const chartData = [
    {
      name: t("platform.workspaceActive"),
      count: activeWorkspaces,
      color: "hsl(var(--success))",
    },
    {
      name: t("platform.workspaceInactive"),
      count: disabledWorkspaces,
      color: "hsl(var(--destructive))",
    },
  ];

  const isAwaitingTrend =
    !activityTrend || activityTrend.length === 0 || activityTrend.every((d) => (d.ops ?? 0) === 0);

  const trendData =
    activityTrend && activityTrend.length > 0
      ? activityTrend
      : [
          { month: "Jan", tenants: activeWorkspaces, ops: 0 },
          { month: "Feb", tenants: activeWorkspaces, ops: 0 },
          { month: "Mar", tenants: activeWorkspaces, ops: 0 },
          { month: "Apr", tenants: activeWorkspaces, ops: 0 },
          { month: "May", tenants: activeWorkspaces, ops: 0 },
          { month: "Jun", tenants: activeWorkspaces, ops: 0 },
        ];

  return (
    <WidgetCard className="p-6 space-y-4 rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm shadow-xs">
      <WidgetCardHeader
        icon={<TrendingUp className="w-4 h-4 text-primary" />}
        title={t("platform.manageMadrasas")}
        subtitle={t("platform.visualizerSubtitle")}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <ReportChartCard title={t("platform.charts.activeVsInactive")} heightClass="h-52">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
            <XAxis
              dataKey="name"
              stroke="currentColor"
              className="text-xs font-semibold text-muted-foreground"
              tickLine={false}
            />
            <YAxis
              stroke="currentColor"
              className="text-xs font-semibold text-muted-foreground"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<PlatformCountTooltip />} />
            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ReportChartCard>

        <ReportChartCard
          title={t("platform.charts.activityTrend")}
          heightClass="h-52"
          actions={
            isAwaitingTrend ? (
              <span className="text-3xs font-semibold text-muted-foreground">
                {t("platform.charts.awaitingTrend")}
              </span>
            ) : undefined
          }
        >
          <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <ChartAreaGradient id={gradientId} color="hsl(var(--primary))" opacity={0.4} />
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
            <XAxis
              dataKey="month"
              stroke="currentColor"
              className="text-xs font-semibold text-muted-foreground"
              tickLine={false}
            />
            <YAxis
              stroke="currentColor"
              className="text-xs font-semibold text-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<PlatformCountTooltip />} />
            <Area
              type="monotone"
              dataKey="ops"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ReportChartCard>
      </div>
    </WidgetCard>
  );
}
