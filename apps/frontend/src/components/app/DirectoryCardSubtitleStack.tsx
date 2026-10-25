import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Optional wrapper when subtitle stacks multiple identity rows (e.g. GR + gender). */
export const DirectoryCardSubtitleStack = function DirectoryCardSubtitleStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.JSX.Element {
  return <div className={cn("mt-0.5 flex flex-col gap-0.5 min-w-0", className)}>{children}</div>;
};
