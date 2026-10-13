import React from "react";
import { StatCard, type StatCardProps } from "@/components/ui/StatCard";
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
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
  6: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6",
  7: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-7",
  8: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8",
};

export const ModuleCommandMetricsGrid = function ModuleCommandMetricsGrid({
  items,
  className,
}: ModuleCommandMetricsGridProps): React.JSX.Element {
  const count = items.length;
  const gridColsClass = GRID_COLS_BY_COUNT[count] ?? GRID_COLS_BY_COUNT[4];

  return (
    <div className={cn("grid gap-2", gridColsClass, className)}>
      {items.map((item, index) => (
        <StatCard
          key={item.key ?? item.label}
          icon={item.icon}
          label={item.label}
          value={item.value}
          sub={item.sub}
          accent={item.accent}
          trend={item.trend}
          trendLabel={item.trendLabel}
          sparklineData={item.sparklineData}
          delayIndex={index}
          onClick={item.onClick}
          isActive={item.isActive}
          variant="compact"
        />
      ))}
    </div>
  );
};
