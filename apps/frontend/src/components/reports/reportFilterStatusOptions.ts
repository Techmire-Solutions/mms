import {
  STUDENT_STATUS_VALUES,
  FACULTY_STATUS_VALUES,
  ENROLLMENT_STATUSES,
  ATTENDANCE_RECORD_STATUSES,
  type AppTranslationKey,
  toTitleCase,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface ReportFilterOption {
  value: string;
  label: string;
}

export function normalizeReportFilterCategory(category?: string): string {
  const c = category?.toLowerCase() || "";
  if (c === "financial") return "finance";
  if (c === "academic") return "examinations";
  if (c === "questionbank") return "question-bank";
  return c;
}

export function getReportFilterStatusOptions(
  normalizedCategory: string,
  t: TranslationFunction,
): ReportFilterOption[] {
  let rawStatuses: readonly string[] = ["all"];

  switch (normalizedCategory) {
    case "students":
      rawStatuses = ["all", ...STUDENT_STATUS_VALUES];
      break;
    case "faculty":
      rawStatuses = ["all", ...FACULTY_STATUS_VALUES];
      break;
    case "enrollments":
      rawStatuses = ["all", ...ENROLLMENT_STATUSES];
      break;
    case "attendance":
      rawStatuses = ["all", ...ATTENDANCE_RECORD_STATUSES];
      break;
    case "finance":
      rawStatuses = ["all", "unpaid", "paid", "partial", "overdue", "cancelled"];
      break;
    case "sessions":
      rawStatuses = ["all", "active", "upcoming", "completed", "cancelled"];
      break;
    case "users":
      rawStatuses = ["all", "active", "inactive", "suspended"];
      break;
    default:
      rawStatuses = ["all", "active", "inactive", "completed"];
      break;
  }

  return rawStatuses.map((st) => {
    if (st === "all") {
      return { value: "all", label: t("reports.filters.allStatuses") };
    }

    let label = "";
    if (normalizedCategory === "students") {
      label = t(`students.status.${st}` as AppTranslationKey);
    } else if (normalizedCategory === "faculty") {
      label = t(`faculty.status.${st}` as AppTranslationKey);
    } else if (normalizedCategory === "enrollments") {
      label = t(`enrollments.status.${st}` as AppTranslationKey);
    } else if (normalizedCategory === "attendance") {
      label = t(`attendance.status.${st}` as AppTranslationKey);
    } else if (normalizedCategory === "finance") {
      label = t(`finance.invoiceStatus.${st}` as AppTranslationKey);
    } else if (normalizedCategory === "sessions") {
      label = t(`sessions.status.${st}` as AppTranslationKey);
    } else if (normalizedCategory === "users") {
      label = t(`users.status.${st}` as AppTranslationKey);
    }

    if (
      !label ||
      label.startsWith("students.") ||
      label.startsWith("faculty.") ||
      label.startsWith("enrollments.") ||
      label.startsWith("attendance.") ||
      label.startsWith("finance.") ||
      label.startsWith("sessions.") ||
      label.startsWith("users.")
    ) {
      label = toTitleCase(st.replace(/_/g, " "));
    }

    return { value: st, label };
  });
}

export function getReportFilterSearchMeta(
  normalizedCategory: string,
  t: TranslationFunction,
): { label: string; placeholder: string } {
  if (normalizedCategory === "faculty") {
    return {
      label: t("faculty.report.colFaculty"),
      placeholder: t("faculty.searchPlaceholder"),
    };
  }
  if (normalizedCategory === "contacts") {
    return {
      label: t("contacts.columns.name"),
      placeholder: t("contacts.searchPlaceholder"),
    };
  }
  return {
    label: t("reports.filters.student"),
    placeholder: t("reports.filters.searchName"),
  };
}
