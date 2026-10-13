import { formatDate, formatDateTime } from "@mms/shared";

/**
 * Format a student custom field value for Work table/cards/detail read rows.
 * SSOT for student custom-field value display (detail + list/card surfaces).
 * Returns `null` when the value is empty so callers decide the empty render.
 */
export function formatStudentsListContentCustomValue(
  value: unknown,
  t: (key: "common.yes" | "common.no" | "students.table.emptyDash") => string,
  type?: string,
): string | null {
  if (value == null) return null;
  if (typeof value === "string" && !value.trim()) return null;
  if (Array.isArray(value)) {
    const joined = value.map(String).filter(Boolean).join(", ");
    return joined || null;
  }
  if (typeof value === "boolean") {
    return value ? t("common.yes") : t("common.no");
  }
  if (typeof value === "string") {
    const isDateLike = type === "date" || type === "datetime" || /^\d{4}-\d{2}-\d{2}/.test(value);
    if (isDateLike && (value.includes("T") || type === "datetime")) {
      return formatDateTime(value, true);
    }
    if (isDateLike) {
      return formatDate(value, true);
    }
  }
  return String(value);
}

export function studentCustomFieldKeyFromColumn(columnKey: string): string | null {
  if (!columnKey.startsWith("custom:")) return null;
  return columnKey.slice("custom:".length);
}
