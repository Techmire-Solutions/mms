import { ReportChartCard } from "@/tenant/components/moduleReports";
import { useTranslation } from "@/hooks/useTranslation";
import { Bar, BarChart, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { chartAxisTick } from "@/components/ui/ChartGrid";

export interface TypeBreakdownEntry {
  name: string;
  total: number;
  count: number;
}

export interface MonthlyTrendEntry {
  month: string;
  total: number;
  count: number;
  label: string;
}

interface ObligationsSummaryChartsSectionProps {
  filteredCount: number;
  typeBreakdown: TypeBreakdownEntry[];
  monthlyTrend: MonthlyTrendEntry[];
  colors: string[];
  primary: string;
  formatCurrency: (amount: number | string | null | undefined) => string;
}

export function ObligationsSummaryChartsSection({
  filteredCount,
  typeBreakdown,
  monthlyTrend,
  colors,
  primary,
  formatCurrency,
}: ObligationsSummaryChartsSectionProps) {
  const { t } = useTranslation();

  if (filteredCount === 0) return null;

  return (
    <section
      aria-label={t("obligations.summary.charts.aria")}
      className="grid grid-cols-1 lg:grid-cols-2 gap-4"
    >
      <ReportChartCard
        title={t("obligations.summary.charts.byTypeTitle")}
        subtitle={t("obligations.summary.charts.byTypeSubtitle")}
        accentColor="primary"
        heightClass="h-chart-md"
      >
        <BarChart data={typeBreakdown} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" tick={chartAxisTick(11)} />
          <YAxis
            tick={chartAxisTick(10)}
            tickFormatter={(value) =>
              value === 0 ? formatCurrency(0) : `${formatCurrency(Math.round(value / 1000))}k`
            }
          />
          <Tooltip
            formatter={(value) => (value !== undefined ? formatCurrency(Number(value)) : "")}
          />
          <Bar dataKey="total" radius={[6, 6, 0, 0]}>
            {typeBreakdown.map((_, index) => (
              <Cell key={index} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ReportChartCard>

      {monthlyTrend.length > 1 ? (
        <ReportChartCard
          title={t("obligations.summary.charts.monthlyTrendTitle")}
          subtitle={t("obligations.summary.charts.monthlyTrendSubtitle")}
          accentColor="info"
          heightClass="h-chart-md"
        >
          <BarChart data={monthlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={chartAxisTick(11)} />
            <YAxis
              tick={chartAxisTick(10)}
              tickFormatter={(value) =>
                value === 0 ? formatCurrency(0) : `${formatCurrency(Math.round(value / 1000))}k`
              }
            />
            <Tooltip
              formatter={(value) => (value !== undefined ? formatCurrency(Number(value)) : "")}
            />
            <Bar dataKey="total" fill={primary} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ReportChartCard>
      ) : (
        <ReportChartCard
          title={t("obligations.summary.charts.distributionTitle")}
          subtitle={t("obligations.summary.charts.distributionSubtitle")}
          accentColor="success"
          heightClass="h-chart-md"
        >
          <PieChart>
            <Pie
              data={typeBreakdown}
              dataKey="total"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {typeBreakdown.map((_, index) => (
                <Cell key={index} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => (value !== undefined ? formatCurrency(Number(value)) : "")}
            />
          </PieChart>
        </ReportChartCard>
      )}
    </section>
  );
}
