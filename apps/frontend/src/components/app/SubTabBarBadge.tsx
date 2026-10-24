import React from "react";
import { cn } from "@/lib/utils";

export interface SubTabBarBadgeProps {
  badge: number | string;
  active: boolean;
  /** When true, applies group-hover muted treatment (underline sub-tab chrome). */
  interactive?: boolean;
}

export type SubTabBadgeProps = SubTabBarBadgeProps;

/** Single sub-tab count pill SSOT. */
export function SubTabBarBadge({
  badge,
  active,
  interactive = false,
}: SubTabBarBadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-2xs font-bold transition-colors",
        active
          ? "bg-primary/15 text-primary"
          : cn(
              "bg-muted text-muted-foreground",
              interactive && "group-hover:bg-muted-foreground/20",
            ),
      )}
    >
      {badge}
    </span>
  );
}

/** Backward-compatibility alias */
export const SubTabBadge = SubTabBarBadge;
