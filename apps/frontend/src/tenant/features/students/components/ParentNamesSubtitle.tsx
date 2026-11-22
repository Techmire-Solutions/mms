import type React from "react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface ParentNamesSubtitleProps {
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  t: TranslationFunction;
  className?: string;
}

/**
 * Shared sub-component for displaying parent/guardian names beneath a student's primary name.
 * Used in both the card-view header (StudentCardHeader) and the desktop table name cell
 * (StudentsListDesktopTableCells) to keep the parent-name rendering logic in one place.
 *
 * Render rules:
 *  - Father rendered first if present.
 *  - Mother rendered second if present.
 *  - Guardian rendered only when both father and mother are absent.
 *  - Returns null when no parent info is available.
 */
export function ParentNamesSubtitle({
  fatherName,
  motherName,
  guardianName,
  t,
  className = "text-xs text-muted-foreground mt-0.5 space-y-0.5",
}: ParentNamesSubtitleProps): React.JSX.Element | null {
  const hasFather = Boolean(fatherName?.trim());
  const hasMother = Boolean(motherName?.trim());
  const hasGuardian = Boolean(guardianName?.trim());
  const showGuardianFallback = !hasFather && !hasMother && hasGuardian;

  if (!hasFather && !hasMother && !showGuardianFallback) return null;

  return (
    <div className={className}>
      {hasFather ? (
        <p dir="auto" className="truncate" title={fatherName}>
          <span>{t("students.detail.father")}:</span> {fatherName}
        </p>
      ) : null}
      {hasMother ? (
        <p dir="auto" className="truncate" title={motherName}>
          <span>{t("students.detail.mother")}:</span> {motherName}
        </p>
      ) : null}
      {showGuardianFallback ? (
        <p dir="auto" className="truncate" title={guardianName}>
          <span>{t("students.idCard.guardian")}:</span> {guardianName}
        </p>
      ) : null}
    </div>
  );
}
