import type React from "react";
import { cn } from "@/lib/utils";

export interface EmptyCellDashProps {
  className?: string;
}

/**
 * Table empty-cell placeholder.
 *
 * Deliberately not `text-muted-foreground/50`: a 50 % muted-foreground em dash is
 * ~2.6:1 on the light surfaces and fails the 4.5:1 text-contrast floor. The full
 * token stays subdued without dropping below the floor.
 */
export function EmptyCellDash({ className }: EmptyCellDashProps): React.JSX.Element {
  return (
    <span aria-hidden="true" className={cn("text-muted-foreground", className)}>
      —
    </span>
  );
}
