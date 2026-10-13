import { ChartAreaGradient } from "@/components/dashboard-widgets/charts/chartPrimitives";
import { PlatformCountTooltip } from "@/platform/components/reports/platformChartTooltips";
import React, { useId, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useTranslation } from "@/hooks/useTranslation";
import { ReportChartCard } from "@/components/reports/ReportChartCard";
import { SubTabBar } from "@/components/app/SubTabBar";
import type { PlatformWorkspaceRow } from "@mms/shared";

type Timeframe = "all" | "1y" | "90d" | "30d";

interface PlatformReportsGrowthChartProps {
  workspaces: PlatformWorkspaceRow[] | undefined;
}

export function PlatformReportsGrowthChart({
  workspaces,
}: PlatformReportsGrowthChartProps): React.JSX.Element {
  const { t } = useTranslation();
  const gradientId = useId();
  const [timeframe, setTimeframe] = useState<Timeframe>("all");

  const filteredWorkspaces = (() => {
    if (!workspaces) return [];
    if (timeframe === "all") return workspaces;
    const now = Date.now();
    const days = timeframe === "30d" ? 30 : timeframe === "90d" ? 90 : 365;
    const threshold = now - days * 24 * 60 * 60 * 1000;
    return workspaces.filter((w) => {
      const created = new Date(w.createdAt).getTime();
      return Number.isFinite(created) && created >= threshold;
    });
  })();

  const growthTrendData = (() => {
    if (!filteredWorkspaces.length) return [];
    const sorted = filteredWorkspaces.toSorted(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const dateMap = new Map<string, number>();
    for (const w of sorted) {
      const d = new Date(w.createdAt);
      if (isNaN(d.getTime())) continue;
      const key =
        timeframe === "30d"
          ? `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      dateMap.set(key, (dateMap.get(key) ?? 0) + 1);
    }
    let cumulative = 0;
    const data: { period: string; count: number; cumulative: number }[] = [];
    for (const [period, count] of dateMap.entries()) {
      cumulative += count;
      data.push({ period, count, cumulative });
    }
    return data;
  })();

  return (
    <ReportChartCard
      heightClass="h-64"
      empty={growthTrendData.length === 0}
      emptyNode={<p className="text-xs text-muted-foreground">{t("apex.noMadrasasYet")}</p>}
      title={t("platform.reports.growthTrend")}
      subtitle={t("platform.reports.growthTrendSub")}
      actions={
        <SubTabBar
          tabs={[
            { key: "all", label: t("platform.reports.timeframeAll") },
            { key: "1y", label: t("platform.reports.timeframe1y") },
            { key: "90d", label: t("platform.reports.timeframe90d") },
            { key: "30d", label: t("platform.reports.timeframe30d") },
          ]}
          value={timeframe}
          onChange={(k) => setTimeframe(k as Timeframe)}
        />
      }
    >
      <AreaChart data={growthTrendData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
        <defs>
          <ChartAreaGradient id={gradientId} color="hsl(var(--primary))" opacity={0.4} />
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.6} />
        <XAxis
          dataKey="period"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<PlatformCountTooltip />} />
        <Area
          type="monotone"
          dataKey="cumulative"
          name={t("platform.reports.cumulative")}
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          fillOpacity={1}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ReportChartCard>
  );
}
