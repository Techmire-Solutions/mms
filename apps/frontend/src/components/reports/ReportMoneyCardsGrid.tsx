import React, { type ReactNode } from "react";
import { EntityCardsGrid } from "@/components/app/EntityCardsGrid";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

/**
 * Card-grid wrapper for report/statement money tiles.
 * Set `surface` when the parent does not already provide `WORK_SURFACE`.
 *
 * Prefer the parameterized `items` + `renderItem` API so large datasets
 * virtualize through `EntityCardsGrid` (lists > 30 items). The `children` form
 * is kept for small, fixed sets and never virtualizes.
 */
export interface ReportMoneyCardsGridProps<T = unknown> {
  children?: ReactNode;
  items?: readonly T[];
  renderItem?: (item: T, index: number) => ReactNode;
  className?: string;
  /** Wrap grid in WORK_SURFACE (default false — parent often owns the surface). */
  surface?: boolean;
}

export function ReportMoneyCardsGrid<T = unknown>({
  children,
  items,
  renderItem,
  className,
  surface = false,
}: ReportMoneyCardsGridProps<T>): React.JSX.Element {
  const grid = (
    <EntityCardsGrid className={cn("p-3", className)} items={items} renderItem={renderItem}>
      {children}
    </EntityCardsGrid>
  );
  if (surface) {
    return <div className={WORK_SURFACE}>{grid}</div>;
  }
  return grid;
}
