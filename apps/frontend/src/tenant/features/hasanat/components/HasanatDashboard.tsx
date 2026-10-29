import React from "react";
import { Card } from "@/components/ui/card";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import { ProgressBar } from "@/components/app/ProgressBar";
import { Star, Package, Gift, RotateCcw, TrendingUp, Layers } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { SafeResponsiveContainer } from "@/components/app/SafeResponsiveContainer";
import type { Denomination, StockBatch, Distribution } from "@/lib/data/hasanatData";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { useTranslation } from "@/hooks/useTranslation";

interface HasanatDashboardProps {
  denoms?: Denomination[];
  batches?: StockBatch[];
  distributions?: Distribution[];
}

/**
 * HasanatDashboard Component
 *
 * Renders the main dashboard for the Hasanat points and cards reward system.
 * Displays overall statistics including total stock, available cards, points distributed,
 * points redeemed, and active/returned statuses. Includes visual donut charts and progress bars
 * showing stock depletion by denomination and overall stock utilization.
 *
 * @returns React element representing the Hasanat points dashboard.
 */
export function HasanatDashboard({
  denoms = [],
  batches = [],
  distributions = [],
}: HasanatDashboardProps) {
  const { t } = useTranslation();
  const palette = useBrandPalette();

  const safeBatches = Array.isArray(batches) ? batches : [];
  const safeDistributions = Array.isArray(distributions) ? distributions : [];
  const safeDenoms = Array.isArray(denoms) ? denoms : [];

  let totalStock = 0;
  let totalRemaining = 0;
  const batchStatsByDenom = new Map<string, { total: number; remaining: number }>();
  for (const batch of safeBatches) {
    totalStock += batch.quantity;
    totalRemaining += batch.remaining;
    let stat = batchStatsByDenom.get(batch.denominationId);
    if (!stat) {
      stat = { total: 0, remaining: 0 };
      batchStatsByDenom.set(batch.denominationId, stat);
    }
    stat.total += batch.quantity;
    stat.remaining += batch.remaining;
  }

  let totalDistributed = 0;
  let totalRedeemed = 0;
  let totalReturned = 0;
  let totalActive = 0;
  for (const distribution of safeDistributions) {
    totalDistributed += distribution.quantity;
    if (distribution.status === "redeemed") totalRedeemed += distribution.quantity;
    else if (distribution.status === "returned") totalReturned += distribution.quantity;
    else if (distribution.status === "active") totalActive += distribution.quantity;
  }
  const usedPct =
    totalStock > 0 ? Math.round(((totalStock - totalRemaining) / totalStock) * 100) : 0;

  const pieData = (() => [
    { name: t("hasanat.status.active"), value: totalActive, color: palette.charts[3] },
    { name: t("hasanat.status.redeemed"), value: totalRedeemed, color: palette.charts[4] },
    { name: t("hasanat.status.returned"), value: totalReturned, color: palette.charts[1] },
    { name: t("hasanat.stats.available"), value: totalRemaining, color: palette.primary },
  ])();

  // Per-denomination stock
  interface DenStockEntry extends Denomination {
    total: number;
    remaining: number;
    used: number;
  }
  const denominationStock: DenStockEntry[] = [];
  for (const denomination of safeDenoms) {
    const stat = batchStatsByDenom.get(denomination.id);
    if (stat && stat.total > 0) {
      denominationStock.push({
        ...denomination,
        total: stat.total,
        remaining: stat.remaining,
        used: stat.total - stat.remaining,
      });
    }
  }

  return (
    <div className="space-y-5">
      <section aria-label={t("hasanat.dashboard.statsAria")}>
        <ModuleCommandMetricsGrid
          items={[
            {
              label: t("hasanat.stats.totalStock"),
              value: totalStock,
              icon: Layers,
              accent: "primary",
            },
            {
              label: t("hasanat.stats.available"),
              value: totalRemaining,
              icon: Package,
              accent: "success",
            },
            {
              label: t("hasanat.stats.distributed"),
              value: totalDistributed,
              icon: Star,
              accent: "warning",
            },
            {
              label: t("hasanat.stats.redeemed"),
              value: totalRedeemed,
              icon: Gift,
              accent: "info",
            },
            {
              label: t("hasanat.stats.active"),
              value: totalActive,
              icon: TrendingUp,
              accent: "info",
            },
            {
              label: t("hasanat.stats.returned"),
              value: totalReturned,
              icon: RotateCcw,
              accent: "destructive",
            },
          ]}
        />
      </section>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribution donut */}
        <Card accentColor="primary" className="p-5 shadow-sm hover:shadow-md border-border/80">
          <h3 className="text-sm font-bold text-foreground mb-4 m-0">
            {t("hasanat.dashboard.cardDistribution")}
          </h3>
          <div className="flex flex-col items-stretch gap-6 sm:flex-row sm:items-center">
            <div className="mx-auto h-32.5 w-full max-w-cell-sm shrink-0 sm:mx-0">
              <SafeResponsiveContainer height={130}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={58}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [
                      t("hasanat.dashboard.cardsCount", { count: Number(value) }),
                      "",
                    ]}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                </PieChart>
              </SafeResponsiveContainer>
            </div>
            <div className="min-w-0 flex-1 space-y-2.5">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex min-w-0 items-center gap-2.5">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: entry.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {entry.name}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-foreground">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Per-denomination stock */}
        <Card accentColor="info" className="p-5 shadow-sm hover:shadow-md border-border/80">
          <h3 className="text-sm font-bold text-foreground mb-4 m-0">
            {t("hasanat.dashboard.stockByDenomination")}
          </h3>
          <div className="space-y-3">
            {denominationStock.map((denomination: DenStockEntry) => {
              const pct =
                denomination.total > 0
                  ? Math.round((denomination.used / denomination.total) * 100)
                  : 0;
              return (
                <div key={denomination.id}>
                  <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-sm" aria-hidden="true">
                        {denomination.icon}
                      </span>
                      <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                        {denomination.name}
                      </span>
                      <span className="shrink-0 text-xs font-bold text-muted-foreground">
                        {t("hasanat.dashboard.pts", { count: denomination.points })}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {denomination.remaining}/{denomination.total}
                    </span>
                  </div>
                  <ProgressBar
                    value={pct}
                    fillStyle={{ background: denomination.color }}
                    trackClassName="bg-border"
                    aria-label={`${denomination.name} stock usage`}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Usage meter */}
      <div>
        <Card accentColor="success" className="p-5 shadow-sm hover:shadow-md border-border/80">
          <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
            <h3 className="m-0 min-w-0 truncate text-sm font-bold text-foreground">
              {t("hasanat.dashboard.overallStockUsage")}
            </h3>
            <span className="shrink-0 text-sm font-bold text-foreground">
              {t("hasanat.dashboard.stockUsagePct", { count: usedPct })}
            </span>
          </div>
          <ProgressBar
            value={usedPct}
            animated
            fillClassName="bg-gradient-to-r from-primary to-success"
            trackClassName="h-3 bg-border"
            transition={{ duration: 0.8, ease: "easeOut" }}
            aria-label={t("hasanat.dashboard.overallStockUsage")}
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-muted-foreground">
              {t("hasanat.dashboard.stockUsed", { count: totalStock - totalRemaining })}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("hasanat.dashboard.stockRemaining", { count: totalRemaining })}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
