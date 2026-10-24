import React from "react";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";
import { ChartGrid, chartAxisTick } from "@/components/app/ChartGrid";
import { ReportChartCard } from "@/components/reports/ReportChartCard";
import { useTranslation } from "@/hooks/useTranslation";
import { buildChartTooltip } from "@/components/dashboard-widgets/charts/chartPrimitives";

const AttendanceChartTooltip = buildChartTooltip({
  valueFormatter: (value) => `${value}%`,
});

import type { AttendanceSummaryItem } from "./attendanceReportTypes";

interface AttendanceReportChartsProps {
  summary: AttendanceSummaryItem[];
  onToggleClassFilter: (className: string) => void;
}

function getActiveLabel(state: unknown): string | null {
  if (!state || typeof state !== "object" || !("activeLabel" in state)) {
    return null;
  }

  const activeLabel = state.activeLabel;
  return typeof activeLabel === "string" && activeLabel.length > 0 ? activeLabel : null;
}

export const AttendanceReportCharts = function AttendanceReportCharts({
  summary,
  onToggleClassFilter,
}: AttendanceReportChartsProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (summary.length === 0) {
    return null;
  }

  return (
    <ReportChartCard
      title={t("attendance.report.rateByClass")}
      accentColor="primary"
      heightClass="h-chart-sm"
    >
      <BarChart
        data={summary}
        barSize={36}
        onClick={(state) => {
          const className = getActiveLabel(state);
          if (className) onToggleClassFilter(className);
        }}
        className="cursor-pointer"
      >
        <ChartGrid />
        <XAxis dataKey="class" tick={chartAxisTick(12)} />
        <YAxis domain={[0, 100]} tick={chartAxisTick(11)} unit="%" />
        <Tooltip content={<AttendanceChartTooltip />} />
        <Bar dataKey="avgRate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ReportChartCard>
  );
};
