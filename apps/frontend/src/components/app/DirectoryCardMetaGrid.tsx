import React from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EntityCardMetaGridProps {
  children: ReactNode;
  className?: string;
}

/** Shared metadata tile grid wrapper for Work directory entity cards. */
export const DirectoryCardMetaGrid = function DirectoryCardMetaGrid({
  children,
  className,
}: EntityCardMetaGridProps): React.JSX.Element {
  return (
    <div
      data-card-meta-grid=""
      className={cn(
        // Two columns at every width (desktop already was): a single column at
        // 375px made each 7-tile card's metadata 407px tall and dominated the
        // mobile directory scroll (2026-10-31 review, UX-17). Tiles are
        // `min-w-0` + `break-words`, so values wrap instead of overflowing.
        "grid grid-cols-2 gap-2 pt-1 border-t border-border/40 dark:border-border/20",
        className,
      )}
    >
      {children}
    </div>
  );
};
