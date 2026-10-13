import type { ReactNode } from "react";
import { formatDate } from "@mms/shared";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { Enrollment } from "@/lib/data/enrollmentData";
import type { Student } from "@mms/shared";
import {
  findEnrollmentStudent,
  getEnrollmentStudentDisplayName,
} from "@/tenant/features/enrollments/lib/enrollmentListContentShared";

/** Render an Enrollments Work column value (non-face columns). */
export function renderEnrollmentWorkColumnValue(
  enrollment: Enrollment,
  columnKey: string,
  options: {
    t: TranslationFunction;
    students: Student[] | Map<string, Student>;
    statusConfig: Record<string, StatusBadgeConfigItem>;
    paymentConfig: Record<string, StatusBadgeConfigItem>;
    formatCurrency: (value: number) => string;
    /** Replacement shown for empty values. */
    emptyFallback?: ReactNode;
  },
): ReactNode {
  const { t, students, statusConfig, paymentConfig, formatCurrency, emptyFallback } = options;

  switch (columnKey) {
    case "student": {
      const student = findEnrollmentStudent(enrollment, students);
      const studentDisplayName = getEnrollmentStudentDisplayName(enrollment, students);
      return (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{studentDisplayName}</span>
          {student?.grNumber && (
            <span className="text-xs font-bold text-primary">
              {t("enrollments.detail.grNumber")}: {student.grNumber}
            </span>
          )}
        </div>
      );
    }
    case "session":
      return <span className="truncate">{enrollment.sessionName}</span>;
    case "class":
      return enrollment.className || "—";
    case "enrolledDate":
      return formatDate(enrollment.enrolledDate);
    case "finalFee":
      return (
        <>
          {formatCurrency(enrollment.finalFee)}
          {enrollment.discountPct > 0 && (
            <span
              className="ms-1 text-xs font-normal text-success"
              aria-label={t("enrollments.discountPctAria", { pct: enrollment.discountPct })}
            >
              –{enrollment.discountPct}%
            </span>
          )}
        </>
      );
    case "status":
      return <StatusBadge status={enrollment.status} config={statusConfig} size="sm" />;
    case "payment":
      return enrollment.paymentStatus ? (
        <StatusBadge status={enrollment.paymentStatus} config={paymentConfig} size="sm" />
      ) : (
        "—"
      );
    case "notes":
      return enrollment.notes?.trim() ? enrollment.notes : emptyFallback;
    default:
      return emptyFallback;
  }
}
