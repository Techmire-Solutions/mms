import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsSkeleton } from "@shared/ui";
import { cn } from "@/lib/utils";

export interface ContactsPageSkeletonProps {
  className?: string;
  viewMode?: "table" | "cards";
}

/**
 * Mobile-optimized Contacts module loading skeleton.
 * Matches ContactsPageView / ContactsWorkTier structure exactly to prevent Cumulative Layout Shift (CLS)
 * and provide instantaneous visual feedback while queries resolve.
 */
export function ContactsPageSkeleton({
  className,
  viewMode = "cards",
}: ContactsPageSkeletonProps): React.JSX.Element {
  return (
    <div
      className={cn("box-border mx-auto w-full min-w-0 max-w-7xl space-y-4", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading contacts...</span>

      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="mt-0.5 h-9 w-9 shrink-0 rounded-xl bg-primary/10" />
          <div className="space-y-2 min-w-0">
            <Skeleton className="h-6 w-32 rounded-md" />
            <Skeleton className="h-4 w-48 sm:w-64 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* Metrics Strip */}
      <StatsSkeleton count={4} className="grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3" />

      {/* 3-Tier Tab Bar */}
      <div className="flex gap-2 border-b border-border pb-2">
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Skeleton className="h-10 w-full sm:w-72 rounded-xl" />
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-20 rounded-xl" />
        </div>
      </div>

      {/* Directory Cards / Table Placeholder */}
      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="space-y-1.5 min-w-0">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-20 rounded" />
                  </div>
                </div>
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              </div>
              <div className="space-y-2 pt-1 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3.5 w-3.5 rounded" />
                  <Skeleton className="h-3.5 w-40 rounded" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3.5 w-3.5 rounded" />
                  <Skeleton className="h-3.5 w-48 rounded" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex gap-1.5">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-16 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      )}
    </div>
  );
}
