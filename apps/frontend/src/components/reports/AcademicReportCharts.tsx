import React from "react";
import { BookOpen } from "lucide-react";
import type { TooltipContentProps } from "recharts";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/app/EmptyState";
import { ChartGrid, chartAxisTick } from "@/components/app/ChartGrid";
import { ChartTooltip, ChartTooltipRow } from "@/components/app/ChartTooltip";
import { buildChartTooltip } from "@/components/dashboard-widgets/charts/chartPrimitives";
import { ReportChartCard } from "@/components/reports/ReportChartCard";
import { useTranslation } from "@/hooks/useTranslation";

import type { AcademicResultItem, ClassRankingItem } from "./academicReportTypes";

const MarksTooltip = buildChartTooltip({
  valueFormatter: (value) => `${value} / 100`,
});

function ClassRankingTooltip({
  active = false,
  payload = [],
  label,
}: Partial<TooltipContentProps>) {
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

interface AcademicReportChartsProps {
  academicResults: AcademicResultItem[];
  classRankings: ClassRankingItem[];
  onToggleStudentFilter: (studentName: string) => void;
  onToggleClassFilter: (className: string) => void;
}

function getActiveLabel(state: unknown): string | null {
  if (!state || typeof state !== "object" || !("activeLabel" in state)) {
    return null;
  }

  const activeLabel = state.activeLabel;
  return typeof activeLabel === "string" && activeLabel.length > 0 ? activeLabel : null;
}

export const AcademicReportCharts = function AcademicReportCharts({
  academicResults,
  classRankings,
  onToggleStudentFilter,
  onToggleClassFilter,
}: AcademicReportChartsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ReportChartCard
        title={t("examinations.report.marksDistribution")}
        accentColor="primary"
        heightClass="h-chart-sm"
      >
        <BarChart
          data={academicResults}
          barSize={28}
          onClick={(state) => {
            const studentName = getActiveLabel(state);
            if (studentName) onToggleStudentFilter(studentName);
          }}
          className="cursor-pointer"
        >
          <ChartGrid />
          <XAxis
            dataKey="studentName"
            tick={chartAxisTick(10)}
            angle={-25}
            textAnchor="end"
            height={40}
          />
          <YAxis domain={[0, 100]} tick={chartAxisTick(11)} />
          <Tooltip content={<MarksTooltip />} />
          <Bar
            dataKey="marks"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
            name={t("examinations.report.marksLabel")}
          />
        </BarChart>
      </ReportChartCard>

      <ReportChartCard
        title={t("examinations.report.classComparison")}
        accentColor="info"
        heightClass="h-chart-sm"
        empty={classRankings.length === 0}
        emptyNode={
          <EmptyState icon={BookOpen} title={t("examinations.report.noClassData")} compact />
        }
      >
        <BarChart
          data={classRankings}
          barSize={32}
          layout="vertical"
          onClick={(state) => {
            const className = getActiveLabel(state);
            if (className) onToggleClassFilter(className);
          }}
          className="cursor-pointer"
        >
          <ChartGrid horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={chartAxisTick(11)} />
          <YAxis type="category" dataKey="class" width={90} tick={chartAxisTick(11)} />
          <Tooltip content={<ClassRankingTooltip />} />
          <Bar
            dataKey="avgMarks"
            fill="hsl(var(--primary))"
            radius={[0, 4, 4, 0]}
            name={t("examinations.report.classAvg")}
          />
        </BarChart>
      </ReportChartCard>
    </div>
  );
};
