import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { SafeResponsiveContainer } from "@/components/ui/SafeResponsiveContainer";
import { ChartGrid, chartAxisTick } from "@/components/ui/ChartGrid";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CARD_STRIPE_INSET } from "@/lib/semanticTone";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import type { ExpenseBreakdownItem } from "./useAccountingDashboardView";

export interface AccountingDashboardChartsProps {
  monthlyData: Array<{ month: string; revenue: number; expenses: number }>;
  expenseBreakdown: ExpenseBreakdownItem[];
  primary: string;
  secondary: string;
  pieColors: readonly string[];
  formatCurrency: (amount: number) => string;
}

export function AccountingDashboardCharts({
  monthlyData,
  expenseBreakdown,
  primary,
  secondary,
  pieColors,
  formatCurrency,
}: AccountingDashboardChartsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card accentColor="primary" className={cn("lg:col-span-2 p-5", CARD_STRIPE_INSET)}>
        <h3 className="text-sm font-bold text-foreground mb-4 m-0">
          {t("accounting.dashboard.revenueVsExpenses")}
        </h3>
        {monthlyData.length === 0 ? (
          <EmptyState
            title={t("accounting.dashboard.noPostedData")}
            compact
            icon={null}
            className="h-48"
          />
        ) : (
          <>
            <div aria-hidden="true">
              <SafeResponsiveContainer height={200}>
                <BarChart data={monthlyData} barGap={4}>
                  <ChartGrid />
                  <XAxis dataKey="month" tick={chartAxisTick(11)} />
                  <YAxis
                    tick={chartAxisTick(11)}
                    tickFormatter={(val) =>
                      val === 0
                        ? formatCurrency(0)
                        : val >= 1000 || val <= -1000
                          ? `${formatCurrency(Math.round(val / 1000))}k`
                          : formatCurrency(val)
                    }
                  />
                  <Tooltip
                    formatter={(val) => (val !== undefined ? formatCurrency(Number(val)) : "")}
                  />
                  <Bar
                    dataKey="revenue"
                    name={t("accounting.dashboard.revenue")}
                    fill={primary}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="expenses"
                    name={t("accounting.dashboard.expenses")}
                    fill={secondary}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </SafeResponsiveContainer>
            </div>
            {/* intentional: sr-only accessible data table for the Recharts BarChart (WCAG 1.1.1).
                Do NOT migrate to WorkBatchTable — this is an invisible a11y annotation that must
                remain co-located with the chart and visually hidden via the .sr-only class. */}
            <table className="sr-only">
              <caption>{t("accounting.dashboard.revenueVsExpensesTable")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("accounting.columns.journal.date")}</th>
                  <th scope="col">{t("accounting.dashboard.revenue")}</th>
                  <th scope="col">{t("accounting.dashboard.expenses")}</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((month) => (
                  <tr key={month.month}>
                    <th scope="row">{month.month}</th>
                    <td>{formatCurrency(month.revenue)}</td>
                    <td>{formatCurrency(month.expenses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>

      <Card accentColor="info" className={cn("p-5", CARD_STRIPE_INSET)}>
        <h3 className="text-sm font-bold text-foreground mb-4 m-0">
          {t("accounting.dashboard.expenseBreakdown")}
        </h3>
        {expenseBreakdown.length === 0 ? (
          <EmptyState
            title={t("accounting.dashboard.noExpenseData")}
            compact
            icon={null}
            className="h-48"
          />
        ) : (
          <>
            <div aria-hidden="true">
              <SafeResponsiveContainer height={150}>
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {expenseBreakdown.map((_, index) => (
                      <Cell key={index} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => (val !== undefined ? formatCurrency(Number(val)) : "")}
                  />
                </PieChart>
              </SafeResponsiveContainer>
            </div>
            <div className="space-y-1 mt-2">
              {expenseBreakdown.map((item, index) => (
                <div
                  key={index}
                  className="flex min-w-0 items-center gap-2 text-xs"
                  aria-label={`${item.name}: ${formatCurrency(item.value)}`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: pieColors[index % pieColors.length] }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.name}</span>
                  <span className="shrink-0 font-mono font-semibold text-foreground">
                    {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
