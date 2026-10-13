import React from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EntityCardMetaGridProps {
  children: ReactNode;
  className?: string;
}

/** Shared metadata tile grid wrapper for Work directory entity cards. */
export const EntityCardMetaGrid = function EntityCardMetaGrid({
  children,
  className,
}: EntityCardMetaGridProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/40 dark:border-border/20",
        className,
      )}
    >
      {children}
    </div>
  );
};
