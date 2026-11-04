import React from "react";
import { BarChart2 } from "lucide-react";
import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";
import { EmptyState } from "@/components/app/EmptyState";
import { ReportChartCard } from "@/tenant/components/moduleReports";
import { useTranslation } from "@/hooks/useTranslation";

interface MessagingChartDatum {
  name: string;
  value: number;
  fillColor?: string;
  /** Stable channel id — the localized `name` cannot drive the a11y summary. */
  channel?: "sms" | "whatsapp" | "email";
}

interface MessagingReportsVolumeChartProps {
  chartData: MessagingChartDatum[];
}

export function MessagingReportsVolumeChart({
  chartData,
}: MessagingReportsVolumeChartProps): React.JSX.Element {
  const { t } = useTranslation();
  const countFor = (channel: MessagingChartDatum["channel"]): number =>
    chartData.find((datum) => datum.channel === channel)?.value ?? 0;

  return (
    <ReportChartCard
      title={t("messaging.volumeBreakdown")}
      subtitle={t("messaging.volumeBreakdownDesc")}
      accentColor="primary"
      heightClass="h-chart-lg"
      // The chart body is `inert`; screen readers get this text instead.
      accessibleSummary={t("messaging.volumeBreakdownSummary", {
        sms: countFor("sms"),
        whatsapp: countFor("whatsapp"),
        email: countFor("email"),
      })}
      empty={chartData.length === 0}
      emptyNode={
        <EmptyState
          title={t("messaging.noDispatches")}
          icon={BarChart2}
          compact
          className="h-chart-lg"
        />
      }
    >
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.fillColor || "var(--color-primary)"} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ReportChartCard>
  );
}
