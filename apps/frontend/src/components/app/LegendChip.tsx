import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type LegendChipDotSize = "sm" | "md";

export interface LegendChipProps {
  label: ReactNode;
  /** Dot `bg-*` class (e.g. `typeConfig.dot`, `b.color`). */
  dotClassName?: string;
  /** Inline dot background — dynamic palette colors. */
  dotStyle?: CSSProperties;
  /** Dot diameter — `sm` (w-2) | `md` (w-2.5). Default `md`. */
  dotSize?: LegendChipDotSize;
  /** Optional trailing value (ms-auto, bold). */
  value?: ReactNode;
  /** Label className override (tone / weight / margin). */
  labelClassName?: string;
  /** Value className override. */
  valueClassName?: string;
  /** Row gap — `sm` (gap-1.5) | `md` (gap-2). Default `sm`. */
  gap?: "sm" | "md";
  /** Container override. */
  className?: string;
}

/**
 * Legend chip — SSOT for the `w-2|w-2.5 rounded-full` color-dot + label row
 * chrome (dashboard / reports / attendance / sessions legends and chart
 * tooltip rows). Dot tone is passed in via `dotClassName` or `dotStyle`.
 */
export function LegendChip({
  label,
  dotClassName,
  dotStyle,
  dotSize = "md",
  value,
  labelClassName,
  valueClassName,
  gap = "sm",
  className,
}: LegendChipProps): React.JSX.Element {
  return (
    <div className={cn("flex items-center", gap === "md" ? "gap-2" : "gap-1.5", className)}>
      <span
        className={cn(
          "shrink-0 rounded-full",
          dotSize === "sm" ? "h-2 w-2" : "h-2.5 w-2.5",
          dotClassName,
        )}
        style={dotStyle}
        aria-hidden="true"
      />
      <span className={cn("text-xs", labelClassName)}>{label}</span>
      {value != null && (
        <span
          className={cn("ms-auto text-xs font-bold text-foreground tabular-nums", valueClassName)}
        >
          {value}
        </span>
      )}
    </div>
  );
}
