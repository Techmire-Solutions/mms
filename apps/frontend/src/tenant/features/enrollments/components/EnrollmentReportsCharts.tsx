import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { chartAxisTick, chartTooltipStyle } from "@/components/app/ChartGrid";
import { ReportChartCard } from "@/tenant/components/moduleReports";
import { EmptyState } from "@/components/app/EmptyState";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { ENROLLMENT_STATUSES } from "@mms/shared";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { useTranslation } from "@/hooks/useTranslation";
import type { EnrollmentsReportAggregates } from "@mms/shared";
import { enrollmentStatusLabels } from "@/lib/ui/enrollmentStatusBadge";

interface EnrollmentReportsChartsProps {
  aggregates: EnrollmentsReportAggregates;
}

export function EnrollmentReportsCharts({
  aggregates,
}: EnrollmentReportsChartsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { formatCurrency: _formatCurrency } = useFinanceCurrency();
  const palette = useBrandPalette();
  const COLORS = (() => [
    palette.primary,
    palette.secondary,
    palette.charts[0],
    palette.charts[3],
  ])();

  const { statusCounts, bySession } = aggregates;

  const statusLabels: Record<string, string> = enrollmentStatusLabels(t);

  const statusData = ENROLLMENT_STATUSES.map((status) => ({
    name: statusLabels[status] ?? status,
    value:
      status === "pending"
        ? statusCounts.pending
        : status === "confirmed"
          ? statusCounts.confirmed
          : status === "cancelled"
            ? statusCounts.cancelled
            : status === "completed"
              ? statusCounts.completed
              : 0,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ReportChartCard
        title={t("enrollments.reports.byStatus")}
        accentColor="primary"
        heightClass="h-chart-md"
      >
        <PieChart>
          <Pie
            data={statusData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={70}
            paddingAngle={3}
          >
            {statusData.map((status, index) => (
              <Cell key={status.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`${value}`, t("enrollments.metrics.total")]}
            contentStyle={chartTooltipStyle()}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
        </PieChart>
      </ReportChartCard>

      <ReportChartCard
        title={t("enrollments.reports.bySession")}
        accentColor="info"
        heightClass="h-chart-md"
        empty={bySession.length === 0}
        emptyNode={
          <EmptyState
            title={t("enrollments.reports.noData")}
            compact
            icon={null}
            className="h-chart-md"
          />
        }
      >
        <BarChart data={bySession} barSize={20}>
          <XAxis dataKey="name" tick={chartAxisTick(10)} tickLine={false} />
          <YAxis tick={chartAxisTick(10)} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value) => [`${value}`, t("enrollments.reports.bySession")]}
            contentStyle={chartTooltipStyle()}
          />
          <Bar
            dataKey="count"
            fill={COLORS[0]}
            radius={[4, 4, 0, 0]}
            name={t("enrollments.reports.bySession")}
          />
        </BarChart>
      </ReportChartCard>
    </div>
  );
}

export default EnrollmentReportsCharts;
