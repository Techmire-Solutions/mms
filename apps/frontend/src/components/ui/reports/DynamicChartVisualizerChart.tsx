import React from "react";
import { Info } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SafeResponsiveContainer } from "@/components/ui/SafeResponsiveContainer";
import { ChartGrid, ChartPolarGrid, chartAxisTick } from "@/components/ui/ChartGrid";
import { capitalize, type AppTranslationKey } from "@mms/shared";
import { getBrandingChartPalette } from "@/lib/brandingChartPalette";
import type {
  AggregatedItem,
  ChartOperation,
  ChartType,
} from "@/components/ui/reports/dynamicChartVisualizerTypes";

export interface DynamicChartVisualizerChartProps {
  chartType: ChartType;
  operation: ChartOperation;
  processedData: AggregatedItem[];
  currentColors: string[];
  showGrid: boolean;
  showLegend: boolean;
  showTooltip: boolean;
  containerWidth: number;
  axisFontSize: number;
  legendFontSize: number;
  tickGap: number;
  t: (key: AppTranslationKey) => string;
}

function operationLabelKey(operation: ChartOperation): AppTranslationKey {
  return `reports.visualizer.op${
    operation === "avg" ? "Avg" : operation === "count" ? "Count" : capitalize(operation)
  }` as AppTranslationKey;
}

export function DynamicChartVisualizerChart({
  chartType,
  operation,
  processedData,
  currentColors,
  showGrid,
  showLegend,
  showTooltip,
  containerWidth,
  axisFontSize,
  legendFontSize,
  tickGap,
  t,
}: DynamicChartVisualizerChartProps): React.JSX.Element | null {
  if (processedData.length === 0) {
    return (
      <EmptyState
        title={t("reports.visualizer.noData")}
        description={t("reports.visualizer.noDataSubtitle")}
        icon={Info}
        variant="dashed"
        className="h-64 border-border/50 bg-card/20 rounded-3xl"
      />
    );
  }

  const firstColor = currentColors[0] || getBrandingChartPalette().primary;
  const seriesName = t(operationLabelKey(operation));
  const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    boxShadow: "var(--shadow-surface)",
    fontSize: `${axisFontSize}px`,
  };
  const axisTick = chartAxisTick(axisFontSize, true);

  switch (chartType) {
    case "bar":
      return (
        <SafeResponsiveContainer
          width="100%"
          height={260}
          minWidth={0}
          minHeight={0}
          initialDimension={{ width: 1, height: 1 }}
        >
          <BarChart data={processedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            {showGrid && <ChartGrid vertical={false} />}
            <XAxis
              dataKey="name"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              interval="preserveEnd"
              minTickGap={tickGap}
            />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} />
            {showTooltip && <Tooltip contentStyle={tooltipStyle} />}
            {showLegend && (
              <Legend wrapperStyle={{ fontSize: `${legendFontSize}px`, paddingTop: "12px" }} />
            )}
            <Bar dataKey="value" name={seriesName} radius={[4, 4, 0, 0]} maxBarSize={30}>
              {processedData.map((_, index) => (
                <Cell key={index} fill={currentColors[index % currentColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </SafeResponsiveContainer>
      );

    case "line":
      return (
        <SafeResponsiveContainer
          width="100%"
          height={260}
          minWidth={0}
          minHeight={0}
          initialDimension={{ width: 1, height: 1 }}
        >
          <LineChart data={processedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            {showGrid && <ChartGrid vertical={false} />}
            <XAxis
              dataKey="name"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              interval="preserveEnd"
              minTickGap={tickGap}
            />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} />
            {showTooltip && <Tooltip contentStyle={tooltipStyle} />}
            {showLegend && (
              <Legend wrapperStyle={{ fontSize: `${legendFontSize}px`, paddingTop: "12px" }} />
            )}
            <Line
              type="monotone"
              dataKey="value"
              name={seriesName}
              stroke={firstColor}
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 1 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </SafeResponsiveContainer>
      );

    case "area":
      return (
        <SafeResponsiveContainer
          width="100%"
          height={260}
          minWidth={0}
          minHeight={0}
          initialDimension={{ width: 1, height: 1 }}
        >
          <AreaChart data={processedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="visGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={firstColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={firstColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            {showGrid && <ChartGrid vertical={false} />}
            <XAxis
              dataKey="name"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              interval="preserveEnd"
              minTickGap={tickGap}
            />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} />
            {showTooltip && <Tooltip contentStyle={tooltipStyle} />}
            {showLegend && (
              <Legend wrapperStyle={{ fontSize: `${legendFontSize}px`, paddingTop: "12px" }} />
            )}
            <Area
              type="monotone"
              dataKey="value"
              name={seriesName}
              stroke={firstColor}
              fill="url(#visGrad)"
              strokeWidth={2.5}
            />
          </AreaChart>
        </SafeResponsiveContainer>
      );

    case "pie":
      return (
        <SafeResponsiveContainer
          width="100%"
          height={260}
          minWidth={0}
          minHeight={0}
          initialDimension={{ width: 1, height: 1 }}
        >
          <PieChart>
            {showTooltip && <Tooltip contentStyle={tooltipStyle} />}
            {showLegend && (
              <Legend
                wrapperStyle={{ fontSize: `${legendFontSize}px` }}
                layout={containerWidth < 450 ? "horizontal" : "vertical"}
                align={containerWidth < 450 ? "center" : "right"}
                verticalAlign={containerWidth < 450 ? "bottom" : "middle"}
              />
            )}
            <Pie
              data={processedData}
              dataKey="value"
              nameKey="name"
              cx={containerWidth < 450 ? "50%" : "40%"}
              cy="50%"
              innerRadius={Math.min(50, Math.round(containerWidth / 10))}
              outerRadius={Math.min(80, Math.round(containerWidth / 6))}
              paddingAngle={3}
              label={
                containerWidth >= 400
                  ? ({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`
                  : false
              }
              labelLine={false}
            >
              {processedData.map((_, index) => (
                <Cell key={index} fill={currentColors[index % currentColors.length]} />
              ))}
            </Pie>
          </PieChart>
        </SafeResponsiveContainer>
      );

    case "radar":
      return (
        <SafeResponsiveContainer
          width="100%"
          height={260}
          minWidth={0}
          minHeight={0}
          initialDimension={{ width: 1, height: 1 }}
        >
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={processedData}>
            <ChartPolarGrid />
            <PolarAngleAxis dataKey="name" tick={chartAxisTick(Math.max(8, axisFontSize - 1))} />
            <PolarRadiusAxis
              angle={30}
              domain={[0, "auto"]}
              tick={chartAxisTick(Math.max(7, axisFontSize - 2))}
            />
            <Radar
              name={seriesName}
              dataKey="value"
              stroke={firstColor}
              fill={firstColor}
              fillOpacity={0.25}
            />
            {showTooltip && <Tooltip contentStyle={tooltipStyle} />}
          </RadarChart>
        </SafeResponsiveContainer>
      );

    default:
      return null;
  }
}
