import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatGridColumns = "1" | "2" | "sm2" | "sm3";

const STAT_GRID_COLUMNS: Record<StatGridColumns, string> = {
  "1": "grid-cols-1",
  "2": "grid-cols-2",
  sm2: "grid-cols-1 sm:grid-cols-2",
  sm3: "grid-cols-1 sm:grid-cols-3",
};

export interface StatGridProps extends HTMLAttributes<HTMLDListElement> {
  /** Column layout — `2` compact, `sm2` mobile-first 2-up, `sm3` 3-up from sm. */
  columns?: StatGridColumns;
}

/**
 * Mobile-card key/value stat grid — SSOT for the
 * `grid grid-cols-* gap-2 text-sm` `<dl>` chrome (obligations / accounting /
 * reports / examinations / attendance cards). Rows via {@link StatRow}.
 */
export function StatGrid({ columns = "2", className, ...props }: StatGridProps): React.JSX.Element {
  return (
    <dl className={cn("grid gap-2 text-sm", STAT_GRID_COLUMNS[columns], className)} {...props} />
  );
}

export interface StatRowProps {
  label: string;
  value: ReactNode;
  /** Secondary `<dd>` line under the value. */
  hint?: ReactNode;
  /** Full-width row spanning all grid columns. */
  fullWidth?: boolean;
  /** Value `<dd>` overrides (font-mono, tone, muted…). */
  ddClassName?: string;
  /** Label `<dt>` overrides (e.g. `mb-1` before a badge value). */
  dtClassName?: string;
  /** Hint `<dd>` overrides (e.g. destructive tone). */
  hintClassName?: string;
  /** Row `<div>` override. */
  className?: string;
}

/**
 * Single key/value row inside a {@link StatGrid}. SSOT for the
 * `<dt class="text-xs font-semibold text-muted-foreground">` + `<dd>` chrome.
 */
export function StatRow({
  label,
  value,
  hint,
  fullWidth,
  ddClassName,
  dtClassName,
  hintClassName,
  className,
}: StatRowProps): React.JSX.Element {
  return (
    <div className={cn(fullWidth && "col-span-full", className)}>
      <dt className={cn("text-xs font-semibold text-muted-foreground", dtClassName)}>{label}</dt>
      <dd className={cn("text-foreground", ddClassName)}>{value}</dd>
      {hint != null && (
        <dd className={cn("text-xs text-muted-foreground", hintClassName)}>{hint}</dd>
      )}
    </div>
  );
}
