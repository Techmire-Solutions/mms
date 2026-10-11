import type { AppTranslationKey } from "@mms/shared";

export type ReportCollection =
  | "students"
  | "faculty"
  | "sessions"
  | "enrollments"
  | "finance_invoices"
  | "attendance_records"
  | "hasanat_distributions"
  | "contacts"
  | "questions"
  | "tests"
  | "assessment_results";

export interface CustomCard {
  id: string;
  role?: string;
  title: string;
  /** When set, UI uses `t(titleKey)` instead of `title`. */
  titleKey?: AppTranslationKey;
  collection: ReportCollection;
  operation: "count" | "sum" | "avg" | "percentage";
  targetField?: string;
  filterField?: string;
  filterOperator?: "equals" | "contains" | "gt" | "lt";
  filterValue?: string;
  icon: string;
  color: string;
  subTextType: "fixed" | "dynamic";
  fixedSubText?: string;
  /** When set (or mapped via DEFAULT_WIDGET_SUBTEXT_KEYS), UI uses `t(fixedSubTextKey)`. */
  fixedSubTextKey?: AppTranslationKey;
  trend?: number;
  trendType?: "manual" | "database";
}

export const COLLECTION_OPTIONS = [
  { value: "students", label: "Students" },
  { value: "faculty", label: "Faculty" },
  { value: "sessions", label: "Sessions" },
  { value: "enrollments", label: "Enrollments" },
  { value: "finance_invoices", label: "Invoices (Finance)" },
  { value: "attendance_records", label: "Attendance Records" },
  { value: "hasanat_distributions", label: "Hasanat Distributions" },
  { value: "contacts", label: "Contacts" },
  { value: "questions", label: "Question Bank Questions" },
  { value: "tests", label: "Generated Tests" },
  { value: "assessment_results", label: "Assessment Results" },
] as const;
