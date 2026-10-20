import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton, StatsSkeleton } from "@shared/ui";
import { cn } from "@/lib/utils";

export type AppPageShellSkeletonSlot = "header" | "metrics" | "tabs" | "filterbar" | "table";

export interface AppPageShellSkeletonProps {
  showHeader?: boolean;
  showMetrics?: boolean;
  showTabs?: boolean;
  showFilterBar?: boolean;
  showTable?: boolean;
  slots?: AppPageShellSkeletonSlot[];
  className?: string;
}

/**
 * Structural layout skeleton shared across platform and tenant pages.
 * Preserves header, metrics strip, tabs, filter bar, and table container dimensions
 * to eliminate Cumulative Layout Shift (CLS = 0) and avoid blank-canvas spinners.
 */
export function AppPageShellSkeleton({
  showHeader = true,
  showMetrics = true,
  showTabs = true,
  showFilterBar = true,
  showTable = true,
  slots,
  className,
}: AppPageShellSkeletonProps = {}): React.JSX.Element {
  const hasHeader = slots ? slots.includes("header") : showHeader;
  const hasMetrics = slots ? slots.includes("metrics") : showMetrics;
  const hasTabs = slots ? slots.includes("tabs") : showTabs;
  const hasFilterBar = slots ? slots.includes("filterbar") : showFilterBar;
  const hasTable = slots ? slots.includes("table") : showTable;

  return (
    <div
      className={cn(
        "box-border mx-auto w-full min-w-0 max-w-7xl space-y-8 sm:space-y-10 animate-pulse motion-reduce:animate-none",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading module content...</span>

      {/* PageHeader Skeleton */}
      {hasHeader ? (
        <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
          <div className="flex min-w-0 items-start gap-3">
            <Skeleton className="mt-0.5 h-9 w-9 shrink-0 rounded-xl bg-primary/10" />
            <div className="space-y-2 min-w-0">
              <Skeleton className="h-6 w-44 rounded-md" />
              <Skeleton className="h-4 w-64 rounded-md" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </div>
      ) : null}

      {/* KPI Metrics Strip Skeleton */}
      {hasMetrics ? <StatsSkeleton count={4} /> : null}

      {/* 3-Tier Tab Bar Skeleton */}
      {hasTabs ? (
        <div className="flex gap-2 border-b border-border pb-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      ) : null}

      {/* Directory Search & Filter Bar Skeleton */}
      {hasFilterBar ? (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Skeleton className="h-10 w-full sm:w-72 rounded-xl" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-24 rounded-xl" />
            <Skeleton className="h-10 w-20 rounded-xl" />
          </div>
        </div>
      ) : null}

      {/* Main Content Table Skeleton */}
      {hasTable ? <TableSkeleton rows={6} cols={5} /> : null}
    </div>
  );
}
