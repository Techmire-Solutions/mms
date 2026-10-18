import React from "react";
import { cn } from "@/lib/utils";

export interface WidgetChartHeaderProps {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  actions?: React.ReactNode;
  headingId?: string;
  className?: string;
}

/** Canonical dashboard chart-widget header chrome — SSOT for title/subtitle/actions chart headers. */
export function WidgetChartHeader({
  title,
  subtitle,
  actions,
  headingId,
  className,
}: WidgetChartHeaderProps): React.JSX.Element {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 mb-5 ps-1.5 select-none",
        className,
      )}
    >
      <div>
        <h3 id={headingId} className="text-sm font-bold text-foreground m-0">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 m-0 font-medium">{subtitle}</p>
      </div>
      {actions && <div className="flex items-center gap-3 ms-auto">{actions}</div>}
    </header>
  );
}
