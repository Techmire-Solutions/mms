import React, { type ReactNode } from "react";
import { EntityCard } from "@/components/ui/EntityCard";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

/**
 * Report/statement money tile — EntityCard shell for financial report cards.
 * Do not use DirectoryCard here (selection/footer chrome is wrong for reports).
 * Non-money report tiles (activity logs, workshop) should use EntityCard directly.
 */
export interface ReportMoneyCardProps {
  children?: ReactNode;
  className?: string;
  /** Full header replacement. When set, title/meta/end are ignored. */
  header?: ReactNode;
  title?: ReactNode;
  meta?: ReactNode;
  /** Right-side header slot (amount, badges, dual figures). */
  end?: ReactNode;
}

export function ReportMoneyCard({
  children,
  className,
  header,
  title,
  meta,
  end,
}: ReportMoneyCardProps): React.JSX.Element {
  const builtHeader =
    header ??
    (title != null || meta != null || end != null ? (
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          {title}
          {meta}
        </div>
        {end != null ? <div className="shrink-0">{end}</div> : null}
      </div>
    ) : null);

  return (
    <EntityCard className={cn(WORK_SURFACE_INNER, "space-y-3 p-3", className)}>
      {builtHeader}
      {children}
    </EntityCard>
  );
}
