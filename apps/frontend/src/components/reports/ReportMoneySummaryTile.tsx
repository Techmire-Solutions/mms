import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ReportMoneySummaryTone = "default" | "soft" | "muted";

const TONE_CLASS: Record<ReportMoneySummaryTone, string> = {
  default: "bg-muted/30",
  soft: "bg-muted/20",
  muted: "bg-muted/10",
};

/**
 * Full-span totals / subtotal tile for report money card grids.
 * Prefer this over hand-rolled `article` / EntityCard summary rows.
 */
export interface ReportMoneySummaryTileProps {
  children?: ReactNode;
  className?: string;
  tone?: ReportMoneySummaryTone;
  /** Optional uppercase label above body content. */
  label?: ReactNode;
  /** Optional trailing value when using simple label+value layout. */
  value?: ReactNode;
}

export function ReportMoneySummaryTile({
  children,
  className,
  tone = "default",
  label,
  value,
}: ReportMoneySummaryTileProps): React.JSX.Element {
  const simpleRow = label != null || value != null;

  return (
    <article
      className={cn(
        "rounded-xl border border-border p-3 col-span-full",
        TONE_CLASS[tone],
        simpleRow && children == null && "flex items-center justify-between gap-3",
        children != null && label != null && "space-y-2",
        className,
      )}
    >
      {label != null && children != null ? (
        <p className="text-xs font-bold uppercase text-muted-foreground m-0 mb-2">{label}</p>
      ) : null}
      {label != null && children == null ? (
        <span className="font-bold text-foreground">{label}</span>
      ) : null}
      {value != null ? (
        <span className="font-mono font-bold text-foreground text-base shrink-0">{value}</span>
      ) : null}
      {children}
    </article>
  );
}
