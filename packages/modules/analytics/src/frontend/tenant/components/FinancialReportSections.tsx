import React from "react";
import { Area, AreaChart, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { ChartGrid, chartAxisTick } from "@mms/ui/app/ChartGrid";
import { ChartTooltip, ChartTooltipRow } from "../host/ChartTooltip";
import { ProgressBar } from "@mms/ui";
import { ReportChartCard } from "./ReportChartCard";
import { Card } from "@mms/ui";
import { CARD_STRIPE_INSET } from "@mms/fe-core/ui/semanticTone";
import { cn } from "@mms/ui";
import { Button } from "@mms/ui";
import { useFinanceCurrency } from "../host/useCurrency";
import { chartDirection } from "../host/reportLibs";
import { EmptyState } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";

export interface MonthlyFeeCollectionItem {
  month: string;
  collected: number;
  outstanding: number;
  total: number;
  rate: number;
}

export interface DiscountUsageByTypeItem {
  type: string;
  count: number;
  totalDiscounted: number;
  percentage: number;
}

interface FinancialReportChartsProps {
  monthlyFeeCollection: MonthlyFeeCollectionItem[];
  discountUsageByType: DiscountUsageByTypeItem[];
  pieColors: string[];
  selectedMonth: string | null;
  onToggleMonthFilter: (month: string) => void;
}

export const FinancialReportCharts = function FinancialReportCharts({
  monthlyFeeCollection,
  discountUsageByType,
  pieColors,
  selectedMonth,
  onToggleMonthFilter,
}: FinancialReportChartsProps): React.JSX.Element {
  const { t, isRtl } = useTranslation();
  const { formatCurrency } = useFinanceCurrency();
  const dir = chartDirection(isRtl);
  const noCollection = monthlyFeeCollection.length === 0;
  const noDiscounts = discountUsageByType.length === 0;

  return (
    <>
      <ReportChartCard
        title={t("finance.report.chartTitle")}
        accentColor="primary"
        heightClass="h-chart-md"
        empty={noCollection}
        emptyNode={
          <EmptyState variant="dashed" title={t("finance.report.noCollectionData")} compact />
        }
      >
        <AreaChart
          data={monthlyFeeCollection}
          onClick={(state: any) => {
            const month = (state as { activeLabel?: string } | undefined)?.activeLabel;
            if (typeof month === "string" && month.length > 0) onToggleMonthFilter(month);
          }}
          className="cursor-pointer"
        >
          <defs>
            <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <ChartGrid />
          <XAxis dataKey="month" tick={chartAxisTick(11)} reversed={dir.xAxisReversed} />
          <YAxis
            tick={chartAxisTick(11)}
            orientation={dir.yAxisOrientation}
            tickFormatter={(value: number) =>
              value === 0 ? formatCurrency(0) : `${formatCurrency(Math.round(value / 1000))}k`
            }
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <ChartTooltip active={active} payload={payload} label={label}>
                  <div className="mt-1 space-y-1">
                    {payload.map((entry: any) => (
                      <ChartTooltipRow
                        key={String(entry.dataKey ?? entry.name)}
                        color={entry.color}
                        name={entry.name}
                        value={formatCurrency(Number(entry.value))}
                      />
                    ))}
                  </div>
                </ChartTooltip>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="collected"
            stroke="hsl(var(--primary))"
            fill="url(#colorCollected)"
            strokeWidth={2}
            name={t("finance.report.collected")}
          />
          <Area
            type="monotone"
            dataKey="outstanding"
            stroke="var(--color-chart-1)"
            fill="transparent"
            strokeWidth={2}
            strokeDasharray="4 2"
            name={t("finance.report.outstandingLabel")}
          />
        </AreaChart>
      </ReportChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card accentColor="primary" className={cn("p-4 space-y-3", CARD_STRIPE_INSET)}>
          <h3 className="text-sm font-bold text-foreground">
            {t("finance.report.collectionRateTitle")}
          </h3>
          <div className="space-y-2">
            {monthlyFeeCollection.map((monthTotals: any) => (
              <Button
                key={monthTotals.month}
                type="button"
                variant="ghost"
                onClick={() => onToggleMonthFilter(monthTotals.month)}
                aria-pressed={selectedMonth === monthTotals.month}
                className={`flex min-h-11 h-auto w-full items-center gap-3 px-2 py-1.5 justify-start ${
                  selectedMonth === monthTotals.month ? "bg-primary/10 text-primary" : ""
                }`}
              >
                <span className="text-xs text-muted-foreground w-20 shrink-0 text-start">
                  {monthTotals.month}
                </span>
                <ProgressBar
                  className="flex-1 gap-3"
                  value={monthTotals.rate}
                  size="md"
                  fillClassName="bg-primary"
                  label={`${monthTotals.rate}%`}
                  labelClassName="w-10 text-end text-foreground"
                />
              </Button>
            ))}
          </div>
        </Card>

        <ReportChartCard
          title={t("finance.report.discountDistributionTitle")}
          accentColor="secondary"
          heightClass="h-chart-sm"
          empty={noDiscounts}
          emptyNode={
            <EmptyState variant="dashed" title={t("finance.report.noDiscountData")} compact />
          }
        >
          <PieChart>
            <Pie
              data={discountUsageByType}
              dataKey="totalDiscounted"
              nameKey="type"
              cx="50%"
              cy="50%"
              outerRadius={70}
              label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {discountUsageByType.map((_: any, index: any) => (
                <Cell key={index} fill={pieColors[index % pieColors.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const first = payload[0];
                return (
                  <ChartTooltip
                    active={active}
                    payload={payload}
                    title={first?.name}
                    value={formatCurrency(Number(first?.value))}
                  />
                );
              }}
            />
            <Legend
              iconSize={10}
              align={dir.legendAlign}
              wrapperStyle={{ fontSize: 11, direction: dir.legendDirection }}
            />
          </PieChart>
        </ReportChartCard>
      </div>
    </>
  );
};
