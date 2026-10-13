import React from "react";
import { cn } from "@/lib/utils";
import { CARD_STRIPE_INSET } from "@/lib/semanticTone";

export interface WidgetCardHeaderProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  variant?: "default" | "tinted" | "destructive";
  headingLevel?: 2 | 3;
  headingId?: string;
  className?: string;
}

/** Canonical dashboard-widget card header chrome — SSOT for title/icon/badge/actions headers on WidgetCard. */
export function WidgetCardHeader({
  title,
  icon,
  badge,
  subtitle,
  actions,
  variant = "default",
  headingLevel = 3,
  headingId,
  className,
}: WidgetCardHeaderProps): React.JSX.Element {
  const HeadingTag = headingLevel === 2 ? "h2" : "h3";
  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 select-none",
        CARD_STRIPE_INSET,
        variant === "default" && "border-b border-border/45",
        variant === "tinted" && "border-b border-border/45 bg-muted/10",
        variant === "destructive" && "border-b border-destructive/25 bg-destructive/[0.06]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        {icon}
        <div className="min-w-0">
          <HeadingTag
            id={headingId}
            className={cn(
              "min-w-0 truncate text-sm font-bold m-0",
              variant === "destructive" ? "text-destructive" : "text-foreground",
            )}
          >
            {title}
          </HeadingTag>
          {subtitle && (
            <p
              className={cn(
                "mt-0.5 m-0 text-xs font-semibold",
                variant === "destructive" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
        {badge}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
