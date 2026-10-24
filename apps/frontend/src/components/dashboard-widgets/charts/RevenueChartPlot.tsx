import { useNavigate } from "react-router-dom";
import { ComposedChart, Bar, Line, Area, XAxis, YAxis, Tooltip } from "recharts";
import { SafeResponsiveContainer } from "@/components/app/SafeResponsiveContainer";
import { ChartGrid, chartAxisTick } from "@/components/app/ChartGrid";
import { ROUTES } from "@/lib/config/routes";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { RevenueChartTooltip } from "@/components/dashboard-widgets/charts/RevenueChartTooltip";
import {
  ChartAreaGradient,
  CHART_AXIS_LINE_PROPS,
} from "@/components/dashboard-widgets/charts/chartPrimitives";
import type { RevenuePoint } from "@/components/dashboard-widgets/charts/useRevenueChartData";

interface RevenueChartPlotProps {
  data: RevenuePoint[];
  chartType: "bar" | "line" | "area";
  activeColors: {
    revenue: string;
    expenses: string;
    fillOpacityRevenue?: number;
    fillOpacityExpenses?: number;
  };
  isEditMode: boolean;
}

export function RevenueChartPlot({
  data,
  chartType,
  activeColors,
  isEditMode,
}: RevenueChartPlotProps) {
  const navigate = useNavigate();
  const { formatCurrency } = useFinanceCurrency();

  const formatYAxisTick = (value: number) => {
    if (value === 0) return formatCurrency(0);
    return `${formatCurrency(Math.round(value / 1000))}k`;
  };

  return (
    <SafeResponsiveContainer height={200}>
      <ComposedChart
        data={data}
        margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
        onClick={() => {
          if (!isEditMode) {
            navigate(ROUTES.accounting);
          }
        }}
        className={isEditMode ? "cursor-default" : "cursor-pointer"}
      >
        <defs>
          <ChartAreaGradient id="revGrad" color={activeColors.revenue} opacity={0.2} />
          <ChartAreaGradient id="expGrad" color={activeColors.expenses} opacity={0.15} />
        </defs>
        <ChartGrid vertical={false} />
        <XAxis dataKey="month" tick={chartAxisTick(11, true)} {...CHART_AXIS_LINE_PROPS} />
        <YAxis
          tick={chartAxisTick(11, true)}
          {...CHART_AXIS_LINE_PROPS}
          tickFormatter={formatYAxisTick}
        />
        <Tooltip
          content={<RevenueChartTooltip />}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
        />

        {chartType === "area" && (
          <>
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={activeColors.revenue}
              strokeWidth={2.5}
              fill="url(#revGrad)"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke={activeColors.expenses}
              strokeWidth={2.5}
              fill="url(#expGrad)"
            />
          </>
        )}
        {chartType === "line" && (
          <>
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={activeColors.revenue}
              strokeWidth={2.5}
              dot={{ r: 3, fill: activeColors.revenue }}
            />
            <Line
              type="monotone"
              dataKey="expenses"
              stroke={activeColors.expenses}
              strokeWidth={2.5}
              dot={{ r: 3, fill: activeColors.expenses }}
            />
          </>
        )}
        {chartType === "bar" && (
          <>
            <Bar
              dataKey="revenue"
              fill={activeColors.revenue}
              fillOpacity={activeColors.fillOpacityRevenue}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
            <Bar
              dataKey="expenses"
              fill={activeColors.expenses}
              fillOpacity={activeColors.fillOpacityExpenses}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          </>
        )}
      </ComposedChart>
    </SafeResponsiveContainer>
  );
}
