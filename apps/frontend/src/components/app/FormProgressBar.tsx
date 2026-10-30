import React from "react";
import { cn } from "@/lib/utils";

export interface FormProgressBarProps {
  value: number;
  label?: React.ReactNode;
  className?: string;
}

/**
 * Header progress indicator for entity forms (0–100%).
 */
export function FormProgressBar({
  value,
  label,
  className,
}: FormProgressBarProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, value));
  const complete = clamped === 100;
  const labelId = React.useId();

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        {label ? (
          <span id={labelId} className="text-xs font-semibold uppercase text-foreground">
            {label}
          </span>
        ) : (
          <span id={labelId} />
        )}
        <span className={cn("text-xs font-bold", complete ? "text-primary" : "text-primary/70")}>
          {Math.round(clamped)}%
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-labelledby={labelId}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            complete ? "bg-primary" : "bg-primary/70",
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
