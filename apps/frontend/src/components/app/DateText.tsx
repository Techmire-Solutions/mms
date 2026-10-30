import React from "react";
import { cn } from "@/lib/utils";

export interface DateTextProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Renders a formatted date in an isolated LTR run so an RTL paragraph cannot
 * reorder the day/month/year segments (or move separators to the wrong edge).
 */
export function DateText({ children, className }: DateTextProps): React.ReactElement {
  return (
    <bdi dir="ltr" className={cn("tabular-nums", className)}>
      {children}
    </bdi>
  );
}

export default DateText;
