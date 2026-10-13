import React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface WidgetCardProps extends React.HTMLAttributes<HTMLDivElement> {
  accentColor?:
    | "primary"
    | "success"
    | "warning"
    | "destructive"
    | "info"
    | "emerald"
    | "indigo"
    | "rose"
    | "amber";
  children: React.ReactNode;
  ariaLabelledby?: string;
  ref?: React.Ref<HTMLDivElement>;
  /** Optional narrative/AI summary text displayed at the bottom of the widget (P3-3). */
  narrativeText?: string;
}

/**
 * WidgetCard is a design system primitive that wraps the Card component.
 * It provides interactive dashboard-specific styles (e.g. lift on hover) and color accent stripes.
 */
export function WidgetCard({
  className,
  accentColor,
  ariaLabelledby,
  children,
  ref,
  narrativeText,
  ...props
}: WidgetCardProps) {
  return (
    <Card
      ref={ref}
      accentColor={accentColor}
      className={cn(
        "hover:-translate-y-1 hover:shadow-surface-lg transition-all duration-300 text-start",
        accentColor === "destructive" && "border-destructive/30 hover:border-destructive/55",
        className,
      )}
      aria-labelledby={ariaLabelledby}
      {...props}
    >
      {children}
      {narrativeText && (
        <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/30 pt-2 mt-2">
          {narrativeText}
        </p>
      )}
    </Card>
  );
}

WidgetCard.displayName = "WidgetCard";
