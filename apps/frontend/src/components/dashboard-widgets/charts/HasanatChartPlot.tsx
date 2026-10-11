import React from "react";
import {
  Cell,
  PieChart,
  Pie,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  RadarChart,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { SafeResponsiveContainer } from "@/components/ui/SafeResponsiveContainer";
import { ChartGrid, ChartPolarGrid, chartAxisTick } from "@/components/ui/ChartGrid";
import { useTranslation } from "@/hooks/useTranslation";
import { formatNumber } from "@mms/shared";
import {
  buildChartTooltip,
  CHART_AXIS_LINE_PROPS,
} from "@/components/dashboard-widgets/charts/chartPrimitives";
import type { HasanatPoint } from "./useHasanatChartData";

const HasanatTooltip = buildChartTooltip({
  valueFormatter: (value, { t }) => t("hasanat.dashboard.pts", { count: formatNumber(value) }),
  titleFromName: true,
});

interface HasanatChartPlotProps {
  chartType: "pie" | "bar" | "radar";
  hasanatData: HasanatPoint[];
  activeColors: { mem: string; att: string; beh: string };
}

export function HasanatChartPlot({
  chartType,
  hasanatData,
  activeColors,
}: HasanatChartPlotProps): React.JSX.Element {
  const { t } = useTranslation();

  if (chartType === "pie") {
    return (
      <div className="flex-shrink-0">
        <PieChart width={120} height={120}>
          <Pie
            data={hasanatData}
            cx="50%"
            cy="50%"
            innerRadius={36}
            outerRadius={54}
            paddingAngle={3}
            dataKey="value"
          >
            {hasanatData.map((hasanatPoint, index) => (
              <Cell key={index} fill={hasanatPoint.color} />
            ))}
          </Pie>
          <Tooltip content={<HasanatTooltip />} />
        </PieChart>
      </div>
    );
  }

  if (chartType === "bar") {
    return (
      <div className="flex-1 w-full">
        <SafeResponsiveContainer height={120}>
          <BarChart data={hasanatData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <ChartGrid vertical={false} />
            <XAxis dataKey="name" tick={chartAxisTick(9, true)} {...CHART_AXIS_LINE_PROPS} />
            <YAxis tick={chartAxisTick(9, true)} {...CHART_AXIS_LINE_PROPS} />
            <Tooltip content={<HasanatTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {hasanatData.map((hasanatPoint, index) => (
                <Cell key={index} fill={hasanatPoint.color} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </SafeResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 w-full sm:w-chart-thumb h-chart-xs">
      <SafeResponsiveContainer height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={hasanatData}>
          <ChartPolarGrid />
          <PolarAngleAxis dataKey="name" tick={chartAxisTick(8, true)} />
          <PolarRadiusAxis angle={30} domain={[0, "auto"]} tick={chartAxisTick(7)} />
          <Radar
            name={t("dashboard.widgets.hasanatPointsSeries")}
            dataKey="value"
            stroke={activeColors.mem}
            fill={activeColors.mem}
            fillOpacity={0.35}
          />
          <Tooltip content={<HasanatTooltip />} />
        </RadarChart>
      </SafeResponsiveContainer>
    </div>
  );
}
