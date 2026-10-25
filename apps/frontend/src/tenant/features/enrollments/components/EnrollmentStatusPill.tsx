import type React from "react";
import type { EnrollmentStatus } from "@mms/shared";
import { LegendChip } from "@/components/app/LegendChip";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export interface EnrollmentStatusPillProps {
  status: EnrollmentStatus | string;
  label?: string;
  className?: string;
}

/**
 * Visual indicator / status pill (LegendChip) for enrollment progression stage.
 * Standardizes status badges with semantic dot colors:
 * - "applied" / "pending": bg-warning
 * - "confirmed" / "active" / "enrolled": bg-success
 * - "suspended" / "retained": bg-warning/80
 * - "completed" / "graduated" / "promoted": bg-info
 * - "cancelled" / "withdrawn" / "left": bg-muted-foreground/60
 */
export function EnrollmentStatusPill({
  status,
  label,
  className,
}: EnrollmentStatusPillProps): React.JSX.Element {
  const { t } = useTranslation();

  const normalized = status ? status.toLowerCase() : "";
  let dotClassName = "bg-muted-foreground/60";

  switch (normalized) {
    case "pending":
    case "applied":
      dotClassName = "bg-warning";
      break;
    case "confirmed":
    case "active":
    case "enrolled":
      dotClassName = "bg-success";
      break;
    case "suspended":
    case "retained":
      dotClassName = "bg-warning/80";
      break;
    case "completed":
    case "graduated":
    case "promoted":
      dotClassName = "bg-info";
      break;
    case "cancelled":
    case "withdrawn":
    case "left":
    default:
      dotClassName = "bg-muted-foreground/60";
      break;
  }

  let displayLabel = label;
  if (!displayLabel) {
    const key = `enrollments.status.${normalized}`;
    const translated = t(key as never);
    displayLabel = translated !== key ? translated : status;
  }

  return (
    <div title={displayLabel} className={cn("inline-flex items-center", className)}>
      <LegendChip
        dotClassName={dotClassName}
        dotSize="sm"
        label={displayLabel}
        labelClassName="text-3xs font-medium text-foreground whitespace-nowrap"
        className="px-2 py-0.5 rounded-full bg-muted/40 border border-border/50"
      />
    </div>
  );
}
