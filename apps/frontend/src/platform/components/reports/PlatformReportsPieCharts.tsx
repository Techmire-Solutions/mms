import { PlatformDistributionTooltip } from "@/platform/components/reports/platformChartTooltips";
import React from "react";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { useTranslation } from "@/hooks/useTranslation";
import { ReportChartCard } from "@/components/ui/reports/ReportChartCard";

const LEGEND_FORMATTER = (value: string) => (
  <span className="text-xs font-semibold text-foreground">{value}</span>
);

interface PlatformReportsPieChartsProps {
  totalWorkspaces: number;
  activeWorkspaces: number;
  disabledWorkspaces: number;
  verifyRequiredCount: number;
  verifyOptionalCount: number;
}

export function PlatformReportsPieCharts({
  totalWorkspaces,
  activeWorkspaces,
  disabledWorkspaces,
  verifyRequiredCount,
  verifyOptionalCount,
}: PlatformReportsPieChartsProps): React.JSX.Element {
  const { t } = useTranslation();

  const statusChartData = [
    { name: t("platform.workspaceActive"), value: activeWorkspaces, color: "hsl(var(--success))" },
    {
      name: t("platform.workspaceInactive"),
      value: disabledWorkspaces,
      color: "hsl(var(--destructive))",
    },
  ];

  const verificationChartData = [
    {
      name: t("platform.emailVerificationRequired"),
      value: verifyRequiredCount,
      color: "hsl(var(--primary))",
    },
    {
      name: t("platform.emailVerificationOptional"),
      value: verifyOptionalCount,
      color: "hsl(var(--muted-foreground))",
    },
  ];

  const renderPie = (data: typeof statusChartData, keyPrefix: string) => (
    <PieChart>
      <Pie
        data={data}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="45%"
        outerRadius={75}
        innerRadius={45}
        paddingAngle={4}
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${keyPrefix}-${index}`} fill={entry.color} />
        ))}
      </Pie>
      <Tooltip content={<PlatformDistributionTooltip />} />
      <Legend verticalAlign="bottom" height={36} formatter={LEGEND_FORMATTER} />
    </PieChart>
  );

  const emptyNode = <p className="text-xs text-muted-foreground">{t("apex.noMadrasasYet")}</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      <ReportChartCard
        title={t("platform.workspaceDistribution")}
        subtitle={t("platform.visualizerSubtitle")}
        heightClass="h-64"
        empty={totalWorkspaces === 0}
        emptyNode={emptyNode}
      >
        {renderPie(statusChartData, "status")}
      </ReportChartCard>
      <ReportChartCard
        title={t("platform.reports.emailVerificationBreakdown")}
        subtitle={t("platform.reports.emailVerificationBreakdownSub")}
        heightClass="h-64"
        empty={totalWorkspaces === 0}
        emptyNode={emptyNode}
      >
        {renderPie(verificationChartData, "verify")}
      </ReportChartCard>
    </div>
  );
}
