import React from "react";
import { Skeleton } from "./Skeleton";
import { cn } from "../utils";

export interface CardSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * A skeleton loader for card-based layouts.
 */
export function CardSkeleton({ count = 3, className = "" }: CardSkeletonProps): React.JSX.Element {
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
}

export interface StatsSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * A skeleton loader for dashboard stat grids.
 */
export function StatsSkeleton({ count = 4, className }: StatsSkeletonProps): React.JSX.Element {
  return (
    <div
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}
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
}

export interface ChartSkeletonProps {
  className?: string;
  heightClassName?: string;
}

/**
 * Skeleton loader for data visualization charts to prevent Cumulative Layout Shift (CLS).
 */
export function ChartSkeleton({
  className = "",
  heightClassName = "h-chart-md",
}: ChartSkeletonProps): React.JSX.Element {
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
}
