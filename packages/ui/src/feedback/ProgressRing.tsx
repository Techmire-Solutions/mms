import React from "react";
import { cn } from "../utils";

export interface ProgressRingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100 progress percentage */
  percentage: number;
  /** Stroke color (hex or CSS color string). Defaults to currentColor / primary */
  colorHex?: string;
  /** When true, renders compact 40px variant instead of standard 64px */
  isCompact?: boolean;
  /** Explicit diameter in pixels (overrides isCompact sizing) */
  size?: number;
  /** Explicit stroke width in pixels */
  strokeWidth?: number;
  /** Whether to render the percentage text in the center (default: true) */
  showPercentage?: boolean;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** Center content override (replaces percentage text) */
  children?: React.ReactNode;
}

/**
 * Modern Web Guidance: progress-ring
 * Accessible circular progress indicator with WAI-ARIA 1.2 progressbar semantics,
 * stroke-dashoffset math, and motion-safe transitions.
 */
export function ProgressRing({
  percentage,
  colorHex,
  isCompact = false,
  size: customSize,
  strokeWidth: customStrokeWidth,
  showPercentage = true,
  ariaLabel,
  className,
  children,
  ...props
}: ProgressRingProps): React.JSX.Element {
  const pct = Math.min(100, Math.max(0, Math.round(percentage)));
  const size = customSize ?? (isCompact ? 40 : 64);
  const strokeWidth = customStrokeWidth ?? (isCompact ? 4 : 6);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  const isDecorative = props["aria-hidden"] === true || props["aria-hidden"] === "true";

  return (
    <div
      role={isDecorative ? undefined : "progressbar"}
      aria-valuenow={isDecorative ? undefined : pct}
      aria-valuemin={isDecorative ? undefined : 0}
      aria-valuemax={isDecorative ? undefined : 100}
      aria-label={isDecorative ? undefined : (ariaLabel ?? `${pct}%`)}
      className={cn("relative flex items-center justify-center flex-shrink-0", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-muted-foreground/15 fill-none"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="fill-none transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none stroke-primary"
          style={colorHex ? { stroke: colorHex } : undefined}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      {children ??
        (showPercentage && (
          <span
            className={cn(
              "absolute font-bold tracking-tight text-foreground select-none",
              isCompact ? "text-[11px]" : "text-xs font-mono",
            )}
            aria-hidden="true"
          >
            {pct}%
          </span>
        ))}
    </div>
  );
}
ProgressRing.displayName = "ProgressRing";
