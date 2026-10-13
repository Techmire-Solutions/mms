import React from "react";
import type { TooltipContentProps } from "recharts";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { ReportChartCard } from "@/components/ui/reports/ReportChartCard";
import { ChartGrid, chartAxisTick } from "@/components/ui/ChartGrid";
import { ChartTooltip, ChartTooltipRow } from "@/components/ui/ChartTooltip";
import type { FacultyWorkloadItem } from "@/components/ui/reports/facultyReportTypes";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

function FacultyWorkloadTooltip({
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

interface FacultyReportChartSectionProps {
  t: TranslationFunction;
  facultyWorkload: FacultyWorkloadItem[];
  onBarClick: (faculty: string) => void;
}

export const FacultyReportChartSection = function FacultyReportChartSection({
  t,
  facultyWorkload,
  onBarClick,
}: FacultyReportChartSectionProps): React.JSX.Element {
  return (
    <ReportChartCard
      title={t("faculty.report.workloadOverview")}
      accentColor="primary"
      heightClass="h-chart-md"
    >
      <BarChart
        data={facultyWorkload}
        barSize={28}
        layout="vertical"
        onClick={(state) => {
          const faculty = (
            state as { activePayload?: Array<{ payload?: { faculty?: string } }> } | undefined
          )?.activePayload?.[0]?.payload?.faculty;
          if (typeof faculty === "string" && faculty.length > 0) onBarClick(faculty);
        }}
        className="cursor-pointer"
      >
        <ChartGrid />
        <XAxis type="number" tick={chartAxisTick(11)} />
        <YAxis dataKey="faculty" type="category" tick={chartAxisTick(11)} width={120} />
        <Tooltip content={<FacultyWorkloadTooltip />} />
        <Bar
          dataKey="totalStudents"
          fill="hsl(var(--primary))"
          name={t("faculty.report.studentsLabel")}
          radius={[0, 4, 4, 0]}
        />
        <Bar
          dataKey="classes"
          fill="hsl(var(--chart-2))"
          name={t("faculty.report.colClasses")}
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ReportChartCard>
  );
};
