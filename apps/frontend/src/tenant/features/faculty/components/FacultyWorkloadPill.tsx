import type React from "react";
import type { Faculty } from "@mms/shared";
import { LegendChip } from "@/components/app/LegendChip";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export interface FacultyWorkloadPillProps {
  faculty: Faculty;
  className?: string;
}

/**
 * Visual indicator / status pill (LegendChip) for faculty workload and tenure status.
 * Renders semantic dot colors: success (active/moderate), warning (heavy load / on leave),
 * info (available / 0 classes), and muted (inactive).
 */
export function FacultyWorkloadPill({
  faculty,
  className,
}: FacultyWorkloadPillProps): React.JSX.Element {
  const { t } = useTranslation();

  const classCount = Array.isArray(faculty.assignedClasses)
    ? faculty.assignedClasses.length
    : typeof (faculty as Record<string, unknown>).assignedClassesCount === "number"
      ? Number((faculty as Record<string, unknown>).assignedClassesCount)
      : 0;

  const isOnLeave = Boolean(faculty.leaveDetails?.isOnLeave);
  const tenureStatus = faculty.employDesignationStatus || faculty.profileStatus || faculty.status;
  const isInactive =
    tenureStatus === "inactive" || tenureStatus === "terminated" || tenureStatus === "retired";

  let dotClassName = "bg-success";
  let label = t("faculty.workload.moderate");

  if (isOnLeave) {
    dotClassName = "bg-warning";
    label = t("faculty.leave.onLeave");
  } else if (isInactive) {
    dotClassName = "bg-muted-foreground/60";
    label = t("faculty.status.inactive");
  } else if (classCount === 0) {
    dotClassName = "bg-info";
    label = t("faculty.workload.available");
  } else if (classCount >= 3) {
    dotClassName = "bg-warning";
    label = t("faculty.workload.heavy");
  }

  const value = classCount > 0 && !isInactive ? `${classCount}` : undefined;
  const tooltip = `${label}${value ? ` (${value})` : ""}`;

  return (
    <div title={tooltip} className={cn("inline-flex items-center", className)}>
      <LegendChip
        dotClassName={dotClassName}
        dotSize="sm"
        label={label}
        value={value}
        labelClassName="text-3xs font-medium text-muted-foreground whitespace-nowrap"
        valueClassName="text-3xs font-semibold text-foreground whitespace-nowrap"
        className="px-1.5 py-0.5 rounded-full bg-muted/40 border border-border/50"
      />
    </div>
  );
}
