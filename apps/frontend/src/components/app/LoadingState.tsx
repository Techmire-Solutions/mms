import React from "react";
import {
  CardSkeleton,
  StatsSkeleton,
  ChartSkeleton,
  TableSkeleton,
  Skeleton,
  type CardSkeletonProps,
  type StatsSkeletonProps,
  type ChartSkeletonProps,
  type TableSkeletonProps,
} from "@shared/ui";

export {
  CardSkeleton,
  StatsSkeleton,
  ChartSkeleton,
  TableSkeleton,
  type CardSkeletonProps,
  type StatsSkeletonProps,
  type ChartSkeletonProps,
  type TableSkeletonProps,
};

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
