import React from "react";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStepItem {
  id: string | number;
  label: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  disabled?: boolean;
}

export interface WizardStepIndicatorProps {
  steps: readonly WizardStepItem[];
  current: number | string;
  className?: string;
  ariaLabel?: string;
  stepStateLabels?: {
    completed?: string;
    current?: string;
    upcoming?: string;
  };
  onStepClick?: (step: WizardStepItem, index: number) => void;
  isStepClickable?: (step: WizardStepItem, index: number) => boolean;
}

/**
 * Standard touch-first, accessible multi-step wizard progress indicator (WCAG 2.1 AA).
 * Enforces 44x44px touch targets and fluid responsive transitions.
 */
export function WizardStepIndicator({
  steps,
  current,
  className,
  ariaLabel = "Wizard progress",
  stepStateLabels = {
    completed: "Completed",
    current: "Current",
    upcoming: "Upcoming",
  },
  onStepClick,
  isStepClickable,
}: WizardStepIndicatorProps): React.JSX.Element {
  // Resolve current index whether `current` is a 1-based/0-based number or an id string
  const currentIndex = typeof current === "number"
    ? (steps.some((step) => typeof step.id === "number" && step.id === current)
        ? steps.findIndex((step) => step.id === current)
        : current)
    : steps.findIndex((step) => step.id === current);

  return (
    <div
      role="list"
      aria-label={ariaLabel}
      className={cn("flex max-w-full items-center gap-0 overflow-x-auto pb-1", className)}
    >
      {steps.map((step, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        const Icon = step.icon;
        const isClickable = Boolean(
          onStepClick &&
            !step.disabled &&
            (isStepClickable ? isStepClickable(step, index) : index <= currentIndex),
        );
        const stateText = isDone
          ? stepStateLabels.completed
          : isActive
            ? stepStateLabels.current
            : stepStateLabels.upcoming;

        const content = isDone ? (
          <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : Icon ? (
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <span className="text-xs font-bold">{index + 1}</span>
        );

        return (
          <React.Fragment key={String(step.id)}>
            <div
              role="listitem"
              aria-current={isActive ? "step" : undefined}
              className="flex min-w-20 flex-col items-center gap-1.5"
            >
              {isClickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(step, index)}
                  className={cn(
                    "flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full border-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isDone
                      ? "border-primary bg-primary text-primary-foreground hover:opacity-90"
                      : isActive
                        ? "border-primary bg-primary/10 text-primary font-bold hover:bg-primary/20"
                        : "border-border bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                  aria-label={`Step ${index + 1}: ${step.label} (${stateText})`}
                >
                  {content}
                </button>
              ) : (
                <div
                  className={cn(
                    "flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full border-2 transition-all",
                    isDone
                      ? "border-primary bg-primary text-primary-foreground"
                      : isActive
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-border bg-muted text-muted-foreground",
                  )}
                  aria-label={`Step ${index + 1}: ${step.label} (${stateText})`}
                >
                  {content}
                </div>
              )}
              <span
                className={cn(
                  "text-xs text-center font-semibold leading-tight whitespace-nowrap px-1",
                  isActive
                    ? "text-primary font-bold"
                    : isDone
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                aria-hidden="true"
                className={cn(
                  "mx-1 mb-5 h-0.5 min-w-4 flex-1 transition-colors",
                  index < currentIndex ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
