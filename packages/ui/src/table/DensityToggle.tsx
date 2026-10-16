import React from "react";
import { AlignJustify } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
import { cn } from "../utils";

/** Aligns with platform workspace density (`usePlatformDensity`). */
export type DensityMode = "compact" | "standard" | "comfortable";

export interface DensityToggleProps {
  density: DensityMode;
  onChange: (d: DensityMode) => void;
  ariaLabel: string;
  labels: Record<DensityMode, string>;
  className?: string;
}

const MODES: { value: DensityMode; lines: number }[] = [
  { value: "compact", lines: 3 },
  { value: "standard", lines: 2 },
  { value: "comfortable", lines: 1 },
];

/**
 * Row-density toggle — Compact / Standard / Comfortable table row height.
 * Works with platform `usePlatformDensity` and `[data-density]` CSS.
 */
export function DensityToggle({
  density,
  onChange,
  ariaLabel,
  labels,
  className,
}: DensityToggleProps): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-0.5",
        className,
      )}
    >
      {MODES.map(({ value }) => {
        const isSelected = density === value;
        const label = labels[value];
        return (
          <Tooltip key={value} delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={label}
                onClick={() => onChange(value)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 w-8 h-8 min-h-11 min-w-11 rounded-md transition-all cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                <AlignJustify
                  className={cn(
                    "transition-all",
                    value === "compact" && "w-3.5 h-3.5",
                    value === "standard" && "w-3 h-3",
                    value === "comfortable" && "w-2.5 h-2.5",
                  )}
                  strokeWidth={value === "compact" ? 2.5 : value === "comfortable" ? 1.5 : 2}
                  aria-hidden="true"
                />
                <span className="sr-only">{label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
