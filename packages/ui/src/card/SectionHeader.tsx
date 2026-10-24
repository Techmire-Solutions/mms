import React from "react";
import { cn } from "../utils";

export interface SectionHeaderProps {
  /** Heading title text or node. */
  title: React.ReactNode;
  /** Leading icon node. */
  icon?: React.ReactNode;
  /** Chip tone override, e.g. "bg-success/10 text-success". */
  iconClassName?: string;
  /** Subtitle text or node. */
  subtitle?: React.ReactNode;
  /** Trailing count/text rendered inside the title block. */
  badge?: React.ReactNode;
  /** Action buttons/elements aligned opposite the title. */
  actions?: React.ReactNode;
  /** Heading semantic level (h2 default, or h3). */
  headingLevel?: 2 | 3;
  /** Optional heading HTML ID. */
  headingId?: string;
  /** "stacked" (responsive column, default) or "row" (flat flex-wrap). */
  layout?: "stacked" | "row";
  /** sm alignment for stacked layouts. */
  align?: "start" | "center";
  /** Drop the default bottom margin (mb-3). */
  noMargin?: boolean;
  /** Additional container classes. */
  className?: string;
}

/** Canonical section-header chrome — SSOT for title/icon-chip/subtitle + actions rows on feature sections. */
export function SectionHeader({
  title,
  icon,
  iconClassName,
  subtitle,
  badge,
  actions,
  headingLevel = 2,
  headingId,
  layout = "stacked",
  align = "center",
  noMargin = false,
  className,
}: SectionHeaderProps): React.JSX.Element {
  const HeadingTag = headingLevel === 2 ? "h2" : "h3";
  return (
    <header
      className={cn(
        "gap-2",
        layout === "stacked"
          ? cn(
              "flex flex-col sm:flex-row sm:justify-between",
              align === "start" ? "sm:items-start" : "sm:items-center",
              noMargin ? "" : "mb-3",
            )
          : "flex flex-wrap items-center justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <div
            className={cn(
              "w-7 h-7 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center",
              iconClassName,
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <HeadingTag
            id={headingId}
            className="m-0 min-w-0 truncate text-sm font-bold text-foreground"
          >
            {title}
          </HeadingTag>
          {subtitle && <p className="text-xs text-muted-foreground m-0 truncate">{subtitle}</p>}
        </div>
        {badge}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export default SectionHeader;
