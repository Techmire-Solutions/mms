import React from "react";
import type { TooltipContentProps } from "recharts";
import { Bar, BarChart, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { ChartGrid, chartAxisTick } from "@/components/ui/ChartGrid";
import { ChartTooltip, ChartTooltipRow } from "@/components/ui/ChartTooltip";
import { buildChartTooltip } from "@/components/dashboard-widgets/charts/chartPrimitives";
import { ReportChartCard } from "@/components/ui/reports/ReportChartCard";
import { useTranslation } from "@/hooks/useTranslation";

function CapacityTooltip({ active = false, payload = [], label }: Partial<TooltipContentProps>) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltip active={active} payload={payload} label={label}>
      <div className="mt-1 space-y-1">
        {payload.map((entry) => (
          <ChartTooltipRow
            key={String(entry.dataKey ?? entry.name)}
            color={entry.color}
            name={entry.name}
            value={entry.value}
          />
        ))}
      </div>
    </ChartTooltip>
  );
}

const TrendTooltip = buildChartTooltip({
  valueFormatter: (value) => String(value),
});

import type { CapacityBarDatum, EnrollmentTrendItem } from "./sessionReportTypes";

interface SessionReportChartsProps {
  capacityChartData: CapacityBarDatum[];
  enrollmentTrends: EnrollmentTrendItem[];
  onToggleClassFilter: (className: string) => void;
  onToggleSessionFilter: (sessionName: string) => void;
}

function getActiveLabel(state: unknown): string | null {
  if (!state || typeof state !== "object" || !("activeLabel" in state)) {
    return null;
  }

  const activeLabel = state.activeLabel;
  return typeof activeLabel === "string" && activeLabel.length > 0 ? activeLabel : null;
}

function getTrendPayload(state: unknown): EnrollmentTrendItem | null {
  if (!state || typeof state !== "object" || !("activePayload" in state)) {
    return null;
  }

  const activePayload = state.activePayload;
  if (!Array.isArray(activePayload)) {
    return null;
  }

  const payload = (activePayload[0] as { payload?: unknown } | undefined)?.payload;
  if (!payload || typeof payload !== "object" || !("sessionName" in payload)) {
    return null;
  }

  return payload as EnrollmentTrendItem;
}

export const SessionReportCharts = function SessionReportCharts({
  capacityChartData,
  enrollmentTrends,
  onToggleClassFilter,
  onToggleSessionFilter,
}: SessionReportChartsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ReportChartCard
        title={t("sessions.report.capacityByClass")}
        accentColor="primary"
        heightClass="h-chart-sm"
      >
        <BarChart
          data={capacityChartData}
          barSize={28}
          onClick={(state) => {
            const className = getActiveLabel(state);
            if (className) onToggleClassFilter(className);
          }}
          className="cursor-pointer"
        >
          <ChartGrid />
          <XAxis dataKey="class" tick={chartAxisTick(11)} />
          <YAxis tick={chartAxisTick(11)} />
          <Tooltip content={<CapacityTooltip />} />
          <Bar
            dataKey="enrolled"
            fill="hsl(var(--primary))"
            stackId="a"
            name={t("sessions.report.enrolledLabel")}
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="available"
            fill="hsl(var(--muted))"
            stackId="a"
            name={t("sessions.report.availableLabel")}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ReportChartCard>

      <ReportChartCard
        title={t("sessions.report.enrollmentTrend")}
        accentColor="info"
        heightClass="h-chart-sm"
      >
        <LineChart
          data={enrollmentTrends}
          onClick={(state) => {
            const trendPayload = getTrendPayload(state);
            if (trendPayload?.sessionName) onToggleSessionFilter(trendPayload.sessionName);
          }}
          className="cursor-pointer"
        >
          <ChartGrid />
          <XAxis dataKey="month" tick={chartAxisTick(11)} />
          <YAxis tick={chartAxisTick(11)} />
          <Tooltip content={<TrendTooltip />} />
          <Line
            type="monotone"
            dataKey="students"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            name={t("sessions.report.studentsLabel")}
          />
        </LineChart>
      </ReportChartCard>
    </div>
  );
};
