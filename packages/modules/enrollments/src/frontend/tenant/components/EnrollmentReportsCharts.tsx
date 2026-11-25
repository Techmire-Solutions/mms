import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { chartAxisTick, chartTooltipStyle } from "@mms/ui/app/ChartGrid";
import { ReportChartCard } from "../host/ModuleReportsTier";
import { EmptyState } from "@mms/ui";
import { useBrandPalette } from "../../tenant/host/BrandingPaletteContext.js";
import { ENROLLMENT_STATUSES } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import type { EnrollmentsReportAggregates } from "@mms/contracts";
import { enrollmentStatusLabels } from "../host/enrollmentStatusBadge";

interface EnrollmentReportsChartsProps {
  aggregates: EnrollmentsReportAggregates;
}

export function EnrollmentReportsCharts({
  aggregates,
}: EnrollmentReportsChartsProps): React.JSX.Element {
  const { t } = useTranslation();
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
    value: statusCounts[status] ?? 0,
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
