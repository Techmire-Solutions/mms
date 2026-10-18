import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import React from "react";
import { cn } from "../utils";

export type ProgressBarSize = "sm" | "md";

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–100 fill percentage. */
  value: number;
  /** Track height — `sm` (h-1.5) | `md` (h-2). */
  size?: ProgressBarSize;
  /** Fill `bg-*` class (e.g. from `rateToneClass` / `utilisationColour`). */
  fillClassName?: string;
  /** Inline fill styles — for dynamic palette `background` colors. */
  fillStyle?: CSSProperties;
  /** Trailing label after the track (e.g. `75%` or a count). */
  label?: ReactNode;
  /** Label className (tone / width / tabular-nums). */
  labelClassName?: string;
  /** Animate width via CSS transition. */
  animated?: boolean;
  /** Transition override when `animated` (duration in seconds, ease function). */
  transition?: { duration?: number; ease?: string | number[] } | Record<string, unknown>;
  /** Track overrides (e.g. `w-16`, `bg-border`, `shadow-inner`). */
  trackClassName?: string;
  /**
   * Optional custom formatter for aria-valuetext to announce human-readable
   * units or metrics to assistive screen readers (e.g. (val) => `${val}% completed`).
   * Modern Web Guidance: accessibility.
   */
  formatValueText?: (value: number) => string;
  "data-testid"?: string;
}

/**
 * Progress / rate bar — SSOT for the
 * `h-1.5|h-2 rounded-full bg-muted` track + `h-full rounded-full bg-*` fill
 * chrome (dashboard widgets / reports / attendance / accounting).
 */
export function ProgressBar({
  value,
  size = "sm",
  fillClassName = "bg-primary",
  fillStyle,
  label,
  labelClassName,
  animated = false,
  transition,
  trackClassName,
  formatValueText,
  className,
  ...props
}: ProgressBarProps): React.JSX.Element {
  const pct = Math.min(100, Math.max(0, value));
  const isDecorative = props["aria-hidden"] === true || props["aria-hidden"] === "true";
  const valueText =
    props["aria-valuetext"] ??
    (formatValueText
      ? formatValueText(pct)
      : typeof label === "string"
        ? label
        : undefined);

  const durationStyle =
    animated &&
    transition &&
    typeof transition === "object" &&
    "duration" in transition &&
    typeof transition.duration === "number"
      ? { transitionDuration: `${transition.duration}s` }
      : undefined;

  const bar = (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-full bg-muted flex-1",
          size === "md" ? "h-2" : "h-1.5",
          trackClassName,
        )}
      >
        <div
          className={cn(
            "h-full rounded-full",
            animated ? "transition-all duration-300 ease-out" : "transition-all",
            fillClassName,
          )}
          style={{ width: `${pct}%`, ...durationStyle, ...fillStyle }}
        />
      </div>
      {label != null && <span className={cn("text-xs font-bold", labelClassName)}>{label}</span>}
    </>
  );

  if (isDecorative) {
    return (
      <div className={cn("flex items-center gap-2", className)} {...props}>
        {bar}
      </div>
    );
  }

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText}
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      {bar}
    </div>
  );

}

ProgressBar.displayName = "ProgressBar";
