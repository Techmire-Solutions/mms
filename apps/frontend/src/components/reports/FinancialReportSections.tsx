import React from "react";
import { Area, AreaChart, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { ChartGrid, chartAxisTick } from "@/components/app/ChartGrid";
import { ChartTooltip, ChartTooltipRow } from "@/components/app/ChartTooltip";
import { ProgressBar } from "@/components/app/ProgressBar";
import { ReportChartCard } from "@/components/reports/ReportChartCard";
import { Card } from "@/components/ui/card";
import { CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { useTranslation } from "@/hooks/useTranslation";

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
  const { t } = useTranslation();
  const { formatCurrency } = useFinanceCurrency();

  return (
    <>
      <ReportChartCard
        title={t("finance.report.chartTitle")}
        accentColor="primary"
        heightClass="h-chart-md"
      >
        <AreaChart
          data={monthlyFeeCollection}
          onClick={(state) => {
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
          <XAxis dataKey="month" tick={chartAxisTick(11)} />
          <YAxis
            tick={chartAxisTick(11)}
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
                    {payload.map((entry) => (
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
            {monthlyFeeCollection.map((monthTotals) => (
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
              {discountUsageByType.map((_, index) => (
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
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ReportChartCard>
      </div>
    </>
  );
};
