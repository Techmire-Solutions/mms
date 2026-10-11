import React from "react";
import { BarChart2 } from "lucide-react";
import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReportChartCard } from "@/tenant/components/moduleReports";
import { useTranslation } from "@/hooks/useTranslation";

interface MessagingChartDatum {
  name: string;
  value: number;
  fillColor?: string;
}

interface MessagingReportsVolumeChartProps {
  chartData: MessagingChartDatum[];
}

export function MessagingReportsVolumeChart({
  chartData,
}: MessagingReportsVolumeChartProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ReportChartCard
      title={t("messaging.volumeBreakdown")}
      subtitle={t("messaging.volumeBreakdownDesc")}
      accentColor="primary"
      heightClass="h-chart-lg"
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
