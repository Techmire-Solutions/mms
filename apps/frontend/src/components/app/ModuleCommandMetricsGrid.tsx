import React from "react";
import { StatCard, type StatCardProps } from "@/components/app/StatCard";
import { cn } from "@/lib/utils";

export interface MetricItem {
  key?: string;
  icon?: StatCardProps["icon"];
  label: string;
  value: string | number;
  sub?: StatCardProps["sub"];
  accent?: StatCardProps["accent"];
  trend?: StatCardProps["trend"];
  trendLabel?: StatCardProps["trendLabel"];
  sparklineData?: StatCardProps["sparklineData"];
  onClick?: StatCardProps["onClick"];
  isActive?: StatCardProps["isActive"];
}

export interface ModuleCommandMetricsGridProps {
  items: MetricItem[];
  className?: string;
}

const GRID_COLS_BY_COUNT: Record<number, string> = {
  1: "grid-cols-1",
  // Two-up from 375px: a single stacked column pushed the directory itself below
  // the fold on mobile, and a 5-item module left a lone card on a second row at
  // 1440 (2026-10-31 review, UX-14/UX-17).
  // 2026-11-04 review (UX-02): 5-up started at lg, where each label had ~48px and
  // was ellipsized. Five-across now starts at xl; lg uses three readable columns.
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6",
  7: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7",
  8: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 2xl:grid-cols-8",
};

/**
 * Odd strips (3/5/7 items) leave one orphan card on the 2-column mobile grid. The
 * last card spans both columns at the base breakpoint and snaps back at `sm`, where
 * the odd count no longer orphans a whole row (2026-11-04 review, UX-12).
 *
 * The span lives on a grid-item wrapper rather than an arbitrary child variant: the
 * generated class is directly assertable and `cn()` never has to parse `[&>…]`.
 */
const ODD_COUNT_LAST_CARD_SPAN = "col-span-2 sm:col-span-1";

export const ModuleCommandMetricsGrid = function ModuleCommandMetricsGrid({
  items,
  className,
}: ModuleCommandMetricsGridProps): React.JSX.Element {
  const count = items.length;
  const gridColsClass = GRID_COLS_BY_COUNT[count] ?? GRID_COLS_BY_COUNT[4];
  const hasMobileOrphan = count > 1 && count % 2 === 1;

  return (
    <div className={cn("grid gap-2", gridColsClass, className)}>
      {items.map((item, index) => (
        <div
          key={item.key ?? item.label}
          className={cn(
            "min-w-0",
            hasMobileOrphan && index === count - 1 && ODD_COUNT_LAST_CARD_SPAN,
          )}
        >
          <StatCard
            icon={item.icon}
            label={item.label}
            value={item.value}
            sub={item.sub}
            accent={item.accent}
            trend={item.trend}
            trendLabel={item.trendLabel}
            sparklineData={item.sparklineData}
            onClick={item.onClick}
            isActive={item.isActive}
            variant="compact"
          />
        </div>
      ))}
    </div>
  );
};
