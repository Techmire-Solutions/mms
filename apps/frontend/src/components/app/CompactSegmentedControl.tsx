import { useId } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CompactSegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface CompactSegmentedControlProps<T extends string> {
  options: readonly CompactSegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Selection tone: "card" (default) | "primary" | "outline". */
  tone?: "card" | "primary" | "outline";
  /** Container: "tray" (default, bordered p-1) | "chips" (borderless wrap row). */
  layout?: "tray" | "chips";
  /** Animate a shared layoutId highlight behind the active option. */
  animated?: boolean;
  /** Stretch each option to equal width (adds flex-1). */
  fill?: boolean;
  className?: string;
  ariaLabel?: string;
}

type Tone = NonNullable<CompactSegmentedControlProps<string>["tone"]>;

const SELECTED_CLASSES: Record<Tone, string> = {
  card: "bg-card text-foreground shadow-sm hover:bg-card hover:text-foreground",
  primary: "bg-primary text-primary-foreground shadow",
  outline: "bg-primary/10 border-primary/30 text-primary",
};

const UNSELECTED_CLASSES: Record<Tone, string> = {
  card: "text-muted-foreground hover:text-foreground hover:bg-muted",
  primary: "text-muted-foreground hover:text-foreground",
  outline:
    "bg-card/30 border-border/50 text-muted-foreground hover:text-foreground hover:bg-card/50",
};

/**
 * Compact small-caps segmented control for report-builder toggle groups
 * (orientation, grid mode, trend source, icon categories). SSOT for the
 * `min-h-11 text-xs font-bold uppercase tracking-wider rounded-lg` chrome.
 */
export function CompactSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  tone = "card",
  layout = "tray",
  animated = false,
  fill = false,
  className,
  ariaLabel,
}: CompactSegmentedControlProps<T>): React.JSX.Element {
  const highlightId = useId();

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "select-none",
        layout === "tray"
          ? "flex items-center gap-1 p-1 rounded-xl border border-border/60 bg-muted/30"
          : "flex flex-wrap gap-1",
        className,
      )}
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-11 h-auto rounded-lg text-xs font-bold uppercase tracking-wider shadow-none transition-all",
              tone === "outline" ? "border px-2" : "px-3",
              fill && "flex-1",
              animated && "relative z-elevated",
              isSelected
                ? animated
                  ? "text-foreground"
                  : SELECTED_CLASSES[tone]
                : UNSELECTED_CLASSES[tone],
            )}
          >
            {isSelected && animated && (
              <motion.div
                layoutId={`${highlightId}-highlight`}
                className="absolute inset-0 bg-card rounded-lg shadow-xs border border-border/40 -z-elevated"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
