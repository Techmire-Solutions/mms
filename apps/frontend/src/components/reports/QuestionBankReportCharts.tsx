import React from "react";
import type { TooltipContentProps } from "recharts";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";
import { ChartGrid, chartAxisTick } from "@/components/app/ChartGrid";
import { ChartTooltip, ChartTooltipRow } from "@/components/app/ChartTooltip";
import { buildChartTooltip } from "@/components/dashboard-widgets/charts/chartPrimitives";
import { ReportChartCard } from "@/components/reports/ReportChartCard";
import { BarChart2 } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { useTranslation } from "@/hooks/useTranslation";

function DifficultyBreakdownTooltip({
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

const CategoryBreakdownTooltip = buildChartTooltip({
  valueFormatter: (value) => String(value),
});

interface QuestionBankReportChartsProps {
  difficultyData: { name: string; questions: number; tests: number }[];
  categoryData: { name: string; questions: number }[];
  hasDifficultyData: boolean;
  hasCategoryData: boolean;
}

export function QuestionBankReportCharts({
  difficultyData,
  categoryData,
  hasDifficultyData,
  hasCategoryData,
}: QuestionBankReportChartsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ReportChartCard
        title={t("questionBank.analytics.difficultyBreakdown")}
        accentColor="primary"
        heightClass="h-chart-sm"
        empty={!hasDifficultyData}
        emptyNode={
          <EmptyState icon={BarChart2} title={t("questionBank.report.noDifficultyData")} compact />
        }
      >
        <BarChart data={difficultyData} barSize={28}>
          <ChartGrid />
          <XAxis dataKey="name" tick={chartAxisTick(10)} />
          <YAxis allowDecimals={false} tick={chartAxisTick(11)} />
          <Tooltip content={<DifficultyBreakdownTooltip />} />
          <Bar
            dataKey="questions"
            name={t("questionBank.questions")}
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="tests"
            name={t("questionBank.report.generatedTests")}
            fill="hsl(var(--chart-2))"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ReportChartCard>

      <ReportChartCard
        title={t("questionBank.analytics.categoryBreakdown")}
        accentColor="secondary"
        heightClass="h-chart-sm"
        empty={!hasCategoryData}
        emptyNode={
          <EmptyState icon={BarChart2} title={t("questionBank.report.noCategoryData")} compact />
        }
      >
        <BarChart data={categoryData} barSize={28} layout="vertical">
          <ChartGrid horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={chartAxisTick(11)} />
          <YAxis type="category" dataKey="name" width={96} tick={chartAxisTick(10)} />
          <Tooltip content={<CategoryBreakdownTooltip />} />
          <Bar
            dataKey="questions"
            name={t("questionBank.questions")}
            fill="hsl(var(--primary))"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ReportChartCard>
    </div>
  );
}

export default QuestionBankReportCharts;
