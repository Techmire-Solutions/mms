import type React from "react";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder rows for the Finance work lists while their first page loads. */
export function FinanceListLoadingSkeleton({
  rows = 6,
  ariaLabel,
}: {
  rows?: number;
  ariaLabel: string;
}): React.JSX.Element {
  return (
    <div role="status" aria-busy="true" aria-label={ariaLabel} className="space-y-2">
      <Skeleton className="h-9 w-full rounded-lg" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}
