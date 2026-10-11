import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { motion, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";

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
  /** Animate width via framer-motion (dispatch progress). */
  animated?: boolean;
  /** framer-motion transition override when `animated` (defaults to 0.2s ease). */
  transition?: Transition;
  /** Track overrides (e.g. `w-16`, `bg-border`, `shadow-inner`). */
  trackClassName?: string;
  "data-testid"?: string;
}

/**
 * Progress / rate bar — SSOT for the
 * `h-1.5|h-2 rounded-full bg-muted` track + `h-full rounded-full bg-*` fill
 * chrome (dashboard widgets / reports / attendance / accounting). Fill tone is
 * passed in via `fillClassName` (from `rateToneClass`, `utilisationColour`, …).
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
  className,
  ...props
}: ProgressBarProps): React.JSX.Element {
  const pct = Math.min(100, Math.max(0, value));

  /**
   * `aria-hidden` means "expose nothing to assistive tech" — which is
   * incompatible with `role="progressbar"` + `aria-valuenow`, because a widget
   * role declares the exact opposite. Eight call sites pass `aria-hidden="true"`
   * (attendance, accounting, sessions, profile, question-bank, dashboard charts)
   * to mark a bar as decorative; spreading it onto the widget produced an
   * `aria-hidden-focus` violation on every one of them, and silently hid the
   * progress value.
   *
   * Handled here, in the SSOT component, so callers keep their intent ("this bar
   * is decorative") without each having to remember the ARIA rule.
   */
  const isDecorative = props["aria-hidden"] === true || props["aria-hidden"] === "true";

  // Single source of the visual chrome, shared by both branches below.
  const bar = (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-full bg-muted flex-1",
          size === "md" ? "h-2" : "h-1.5",
          trackClassName,
        )}
      >
        {animated ? (
          <motion.div
            className={cn("h-full rounded-full", fillClassName)}
            style={fillStyle}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={transition ?? { duration: 0.2 }}
          />
        ) : (
          <div
            className={cn("h-full rounded-full transition-all", fillClassName)}
            style={{ width: `${pct}%`, ...fillStyle }}
          />
        )}
      </div>
      {label != null && <span className={cn("text-xs font-bold", labelClassName)}>{label}</span>}
    </>
  );

  // Decorative: no widget role, so the two ARIA contracts cannot contradict.
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
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      {bar}
    </div>
  );
}
