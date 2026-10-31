import type React from "react";
import { LegendChip } from "@/components/app/LegendChip";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/data/sessionsData";
import { getSessionEnrollmentTotals } from "@/tenant/features/sessions/lib/sessionsWorkListViewsShared";

export interface SessionCapacityPillProps {
  session?: Session;
  totalEnrolled?: number;
  totalCapacity?: number;
  className?: string;
}

/**
 * Visual indicator / capacity pill (LegendChip) for session and section capacity.
 * Colors:
 * - bg-success: <= 80% capacity
 * - bg-warning: 81% - 99% capacity
 * - bg-destructive: >= 100% (at or over capacity)
 * - bg-muted-foreground/60: when capacity is 0 / not specified
 */
export function SessionCapacityPill({
  session,
  totalEnrolled: propEnrolled,
  totalCapacity: propCapacity,
  className,
}: SessionCapacityPillProps): React.JSX.Element {
  const { t } = useTranslation();

  const totals = session ? getSessionEnrollmentTotals(session) : undefined;
  const enrolled = propEnrolled ?? totals?.totalEnrolled ?? 0;
  const capacity = propCapacity ?? totals?.totalCapacity ?? 0;

  const percent = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;

  let dotClassName = "bg-muted-foreground/60";
  if (capacity > 0) {
    if (percent >= 100) {
      dotClassName = "bg-destructive";
    } else if (percent > 80) {
      dotClassName = "bg-warning";
    } else {
      dotClassName = "bg-success";
    }
  }

  const label = capacity > 0 ? `${enrolled}/${capacity}` : `${enrolled}`;
  const value = capacity > 0 ? `${percent}%` : undefined;
  const tooltip =
    capacity > 0
      ? t("sessions.card.capacityUsed", {
          percent,
          count: session?.classes?.length ?? 0,
          classesLabel: t("sessions.card.classPlural"),
        })
      : `${enrolled} ${t("sessions.columns.enrolled")}`;

  return (
    <div title={tooltip} className={cn("inline-flex items-center", className)}>
      <LegendChip
        dotClassName={dotClassName}
        dotSize="sm"
        label={label}
        value={value}
        labelClassName="text-3xs font-medium text-foreground whitespace-nowrap"
        valueClassName="text-3xs font-bold text-muted-foreground whitespace-nowrap"
        className="px-2 py-0.5 rounded-full bg-muted/40 border border-border/50"
      />
    </div>
  );
}
