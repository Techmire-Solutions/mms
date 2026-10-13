import React, { type ReactNode } from "react";
import { EntityCardsGrid } from "@/components/app/EntityCardsGrid";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

/**
 * Card-grid wrapper for report/statement money tiles.
 * Set `surface` when the parent does not already provide `WORK_SURFACE`.
 */
export interface ReportMoneyCardsGridProps {
  children: ReactNode;
  className?: string;
  /** Wrap grid in WORK_SURFACE (default false — parent often owns the surface). */
  surface?: boolean;
}

export function ReportMoneyCardsGrid({
  children,
  className,
  surface = false,
}: ReportMoneyCardsGridProps): React.JSX.Element {
  const grid = <EntityCardsGrid className={cn("p-3", className)}>{children}</EntityCardsGrid>;
  if (surface) {
    return <div className={WORK_SURFACE}>{grid}</div>;
  }
  return grid;
}
