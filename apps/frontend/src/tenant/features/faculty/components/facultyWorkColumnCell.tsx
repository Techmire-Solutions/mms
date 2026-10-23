import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { customFieldKeyFromColumnKey, type Faculty, type FacultyCustomField } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { StatusBadge } from "@/components/app/StatusBadge";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { resolveFacultyFieldDisplayText } from "@/tenant/features/faculty/lib/facultyFieldDisplay";

export interface RenderFacultyWorkColumnOptions {
  t: TranslationFunction;
  statusConfig: Record<string, StatusBadgeConfigItem>;
  customFieldsById?: Map<string, FacultyCustomField>;
  statusBadgeSize?: "sm" | "md";
  /** Replacement shown for empty values (Contacts/Students `emptyDash` parity). */
  emptyFallback?: ReactNode;
}

/** Render a Faculty Work column cell (system or custom:`id`). */
export function renderFacultyWorkColumnValue(
  faculty: Faculty,
  columnKey: string,
  options: RenderFacultyWorkColumnOptions,
): ReactNode {
  const { t, statusConfig, customFieldsById, statusBadgeSize, emptyFallback } = options;
  if (columnKey === "status") {
    const isLeave = Boolean(faculty.leaveDetails?.isOnLeave);
    const subName = faculty.leaveDetails?.substituteFacultyName;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={faculty.status} config={statusConfig} size={statusBadgeSize} />
        {isLeave ? (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-medium bg-warning/10 text-warning border border-warning/30"
            title={subName ? t("faculty.leave.substituteBadge", { name: subName }) : undefined}
          >
            {t("faculty.leave.onLeave")}
          </span>
        ) : null}
      </div>
    );
  }
  if (columnKey === "employmentContractType") {
    const contractType = faculty.employmentContractType;
    if (!contractType) return emptyFallback;
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground border border-border">
        {t(`faculty.contract.${contractType}` as "faculty.contract.salaried")}
      </span>
    );
  }
  if (columnKey === "employDesignationStatus" || columnKey === "profileStatus") {
    const tenureStatus = faculty.employDesignationStatus || faculty.profileStatus;
    if (!tenureStatus) return emptyFallback;
    return <StatusBadge status={tenureStatus} config={statusConfig} size={statusBadgeSize} />;
  }
  if (columnKey === "designation") {
    const value = resolveFacultyFieldDisplayText(faculty, columnKey, {
      t,
      notSpecifiedFallback: false,
    });
    if (value === undefined || value === "") return emptyFallback;
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20 truncate max-w-full">
        {value}
      </span>
    );
  }
  if (columnKey === "reportingFacultyId" || columnKey === "reportingFacultyName") {
    const value =
      faculty.reportingFacultyName ||
      resolveFacultyFieldDisplayText(faculty, columnKey, { t, notSpecifiedFallback: false });
    if (value === undefined || value === "") return emptyFallback;
    return <span className="text-sm font-medium text-foreground truncate block">{value}</span>;
  }
  if (columnKey === "subordinateCount") {
    const count = faculty.subordinateCount ?? 0;
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
        {count} {t("faculty.field.subordinates")}
      </span>
    );
  }
  if (columnKey === "performanceRating") {
    const rating = faculty.performanceRating;
    if (rating === undefined || rating === null) return emptyFallback;
    return (
      <span className="inline-flex items-center gap-1 font-medium text-xs text-foreground">
        <Star className="w-3.5 h-3.5 text-warning fill-warning" aria-hidden />
        {rating}
      </span>
    );
  }
  if (columnKey === "assignedClassesCount" || columnKey === "assignedClasses") {
    const rawCount = Array.isArray(faculty.assignedClasses)
      ? faculty.assignedClasses.length
      : typeof (faculty as Record<string, unknown>).assignedClassesCount === "number"
        ? (faculty as Record<string, unknown>).assignedClassesCount
        : undefined;
    if (rawCount === undefined) return emptyFallback;
    const countNumber = Number(rawCount);
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-info/10 text-info border border-info/20">
        {countNumber} {t("faculty.detail.assignedClasses")}
      </span>
    );
  }
  const customFieldId = customFieldKeyFromColumnKey(columnKey);
  const customFieldLabel =
    customFieldId !== null ? customFieldsById?.get(customFieldId)?.label : undefined;
  const value = resolveFacultyFieldDisplayText(faculty, columnKey, {
    t,
    customFieldLabel,
    notSpecifiedFallback: false,
  });
  if (value === undefined || value === "") return emptyFallback;
  return value;
}
