import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton, type TableSkeletonProps } from "@/components/ui/table/TableSkeleton";
import { cn } from "@/lib/utils";

/**
 * A full-page loading spinner with the app's branding.
 */
export const PageLoader = function PageLoader(): React.ReactElement {
  return (
    <div
      className="flex items-center justify-center min-h-viewport-half"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="text-primary font-display text-xl font-bold">م</span>
        </div>
        <div
          className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

interface CardSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * A skeleton loader for card-based layouts.
 */
export const CardSkeleton = function CardSkeleton({
  count = 3,
  className = "",
}: CardSkeletonProps): React.ReactElement {
  return (
    <div className={cn("grid gap-4", className)} role="status" aria-live="polite" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/3 rounded" />
              <Skeleton className="h-3 w-1/3 rounded" />
            </div>
          </div>
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-4/5 rounded" />
        </div>
      ))}
    </div>
  );
};

interface StatsSkeletonProps {
  count?: number;
}

/**
 * A skeleton loader for dashboard stat grids.
 */
export const StatsSkeleton = function StatsSkeleton({
  count = 4,
}: StatsSkeletonProps): React.ReactElement {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="w-8 h-8 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-16 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      ))}
    </div>
  );
};

/**
 * @deprecated Import `TableSkeleton` from `@/components/ui/table` directly.
 * Re-exported here as a non-breaking compatibility bridge.
 */
export { TableSkeleton, type TableSkeletonProps };

/**
 * Skeleton loader for data visualization charts to prevent Cumulative Layout Shift.
 */
export interface ChartSkeletonProps {
  className?: string;
  heightClassName?: string;
}

export const ChartSkeleton = function ChartSkeleton({
  className = "",
  heightClassName = "h-chart-md",
}: ChartSkeletonProps): React.ReactElement {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-card/40 p-4 space-y-4", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className={cn("flex items-end justify-between gap-2 pt-4 px-2", heightClassName)}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <Skeleton
              className="w-full rounded-t-md"
              style={{ height: `${25 + ((i * 17) % 65)}%` }}
            />
            <Skeleton className="h-2.5 w-6 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton loader matching Three-Tier Module layout to eliminate Cumulative Layout Shift (CLS).
 */
export const ModuleViewSkeleton = function ModuleViewSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-live="polite" aria-busy="true">
      {/* Module Header Skeleton */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>

      {/* KPI Stats Grid Skeleton */}
      <StatsSkeleton count={4} />

      {/* Main Content Table/Grid Skeleton */}
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
};
