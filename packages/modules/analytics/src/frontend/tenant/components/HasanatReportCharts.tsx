import React from "react";
import type { TooltipContentProps } from "recharts";
import { Bar, BarChart, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { ChartGrid, chartAxisTick } from "@mms/ui/app/ChartGrid";
import { ChartTooltip, ChartTooltipRow } from "../host/ChartTooltip";
import { buildChartTooltip } from "../host/dashboardWidgets";
import { formatNumber } from "@mms/contracts";
import { ReportChartCard } from "./ReportChartCard";
import { LegendChip } from "@mms/ui/app/LegendChip";
import { useTranslation } from "@mms/fe-core/i18n";
import type { HasanatFacultyBarItem, HasanatPieItem } from "./hasanatReportSectionTypes";

function HasanatBarTooltip({ active = false, payload = [], label }: Partial<TooltipContentProps>) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltip active={active} payload={payload} label={label}>
      <div className="mt-1 space-y-1">
        {payload.map((entry: any) => (
          <ChartTooltipRow
            key={String(entry.dataKey ?? entry.name)}
            color={entry.color}
            name={entry.name}
            value={formatNumber(Number(entry.value))}
          />
        ))}
      </div>
    </ChartTooltip>
  );
}

const HasanatPieTooltip = buildChartTooltip({
  valueFormatter: (value: any) => formatNumber(value),
  titleFromName: true,
});

interface HasanatReportChartsProps {
  facultyChartData: HasanatFacultyBarItem[];
  redemptionPieData: HasanatPieItem[];
  pieColors: string[];
  onToggleFacultyFilter: (faculty: string) => void;
}

export const HasanatReportCharts = function HasanatReportCharts({
  facultyChartData,
  redemptionPieData,
  pieColors,
  onToggleFacultyFilter,
}: HasanatReportChartsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ReportChartCard
        title={t("hasanat.report.distributionByFaculty")}
        accentColor="primary"
        heightClass="h-chart-sm"
      >
        <BarChart
          data={facultyChartData}
          barSize={22}
          onClick={(state: any) => {
            const faculty = (
              state as { activePayload?: Array<{ payload?: { faculty?: string } }> } | undefined
            )?.activePayload?.[0]?.payload?.faculty;
            if (typeof faculty === "string" && faculty.length > 0) onToggleFacultyFilter(faculty);
          }}
          className="cursor-pointer"
        >
          <ChartGrid />
          <XAxis dataKey="faculty" tick={chartAxisTick(11)} />
          <YAxis tick={chartAxisTick(11)} />
          <Tooltip content={<HasanatBarTooltip />} />
          <Bar
            dataKey="distributed"
            fill="hsl(var(--primary))"
            name={t("hasanat.report.distributed")}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="redeemed"
            fill="hsl(var(--chart-2))"
            name={t("hasanat.report.redeemed")}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ReportChartCard>

      <ReportChartCard
        title={t("hasanat.report.redeemedVsBalance")}
        accentColor="secondary"
        heightClass="h-chart-sm"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {redemptionPieData.map((slice: any, index: any) => (
              <LegendChip
                key={slice.name}
                dotStyle={{ background: pieColors[index % pieColors.length] }}
                label={<span className="text-xs text-muted-foreground">{slice.name}</span>}
                value={formatNumber(slice.value)}
              />
            ))}
          </div>
        }
      >
        <PieChart>
          <Pie
            data={redemptionPieData}
            cx="50%"
            cy="50%"
            innerRadius={35}
            outerRadius={65}
            paddingAngle={3}
            dataKey="value"
          >
            {redemptionPieData.map((_: any, index: any) => (
              <Cell key={index} fill={pieColors[index % pieColors.length]} />
            ))}
          </Pie>
          <Tooltip content={<HasanatPieTooltip />} />
        </PieChart>
      </ReportChartCard>
    </div>
  );
};
