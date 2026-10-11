/**
 * @file enrollmentsExportUtils.ts
 * @description Enrollments module export utilities covering all form tabs and entity attributes.
 */
import type { Enrollment } from "./enrollmentsModuleManifest.js";
import { buildExportGrid } from "./dataTransfer/export/buildExportGrid.js";
import type { ExportColumn } from "./dataTransfer/core/exportTypes.js";

export interface EnrollmentExportColumn {
  id: string;
  label: string;
}

const ENROLLMENT_EXPORT_ALWAYS_VISIBLE = new Set([
  "studentName",
  "sessionName",
  "className",
  "enrolledDate",
  "finalFee",
  "status",
  "paymentStatus",
]);

export const DEFAULT_ENROLLMENT_EXPORT_COLUMNS: readonly EnrollmentExportColumn[] = [
  { id: "studentName", label: "Student" },
  { id: "studentId", label: "Student ID" },
  { id: "sessionName", label: "Session" },
  { id: "sessionId", label: "Session ID" },
  { id: "className", label: "Class" },
  { id: "classId", label: "Class ID" },
  { id: "enrolledDate", label: "Enrolled Date" },
  { id: "baseFee", label: "Base Fee" },
  { id: "discountType", label: "Discount Type" },
  { id: "discountLabel", label: "Discount Label" },
  { id: "discountPct", label: "Discount %" },
  { id: "discountAmt", label: "Discount Amount" },
  { id: "finalFee", label: "Final Fee" },
  { id: "status", label: "Status" },
  { id: "paymentStatus", label: "Payment Status" },
  { id: "invoiceId", label: "Invoice ID" },
  { id: "notes", label: "Notes" },
  { id: "timelineCount", label: "Timeline Events" },
  { id: "timelineSummary", label: "Timeline Summary" },
  { id: "createdAt", label: "Created At" },
  { id: "updatedAt", label: "Updated At" },
] as const;

export const ALL_ENROLLMENT_EXPORT_COLUMNS = DEFAULT_ENROLLMENT_EXPORT_COLUMNS;

/** Resolves all enrollment export columns. */
export function resolveAllEnrollmentExportColumns(): EnrollmentExportColumn[] {
  return [...ALL_ENROLLMENT_EXPORT_COLUMNS];
}

/** Merges custom columns into an enrollment export column list. */
export function mergeCustomEnrollmentExportColumns(
  columns: EnrollmentExportColumn[],
  customColumns?: EnrollmentExportColumn[] | null,
): EnrollmentExportColumn[] {
  const seen = new Set(columns.map((c) => c.id));
  const result = [...columns];
  if (Array.isArray(customColumns)) {
    for (const col of customColumns) {
      if (col?.id && !seen.has(col.id)) {
        seen.add(col.id);
        result.push(col);
      }
    }
  }
  return result;
}

/** Filters export columns for viewers. */
export function filterEnrollmentExportColumnsForViewer(
  columns: EnrollmentExportColumn[],
): EnrollmentExportColumn[] {
  if (columns.length === 0) {
    return resolveAllEnrollmentExportColumns();
  }
  return columns.filter(
    (column) =>
      ENROLLMENT_EXPORT_ALWAYS_VISIBLE.has(column.id) ||
      DEFAULT_ENROLLMENT_EXPORT_COLUMNS.some((c) => c.id === column.id) ||
      column.id.startsWith("custom:"),
  );
}

/** Pure cell extractor for Enrollment entities. */
export function extractEnrollmentCell(
  enrollment: Enrollment,
  columnId: string,
): string | number | null {
  if (columnId === "studentName") return enrollment.studentName || "";
  if (columnId === "studentId") return enrollment.studentId || "";
  if (columnId === "sessionName") return enrollment.sessionName || "";
  if (columnId === "sessionId") return enrollment.sessionId || "";
  if (columnId === "className") return enrollment.className || "";
  if (columnId === "classId") return enrollment.classId || "";
  if (columnId === "enrolledDate") return enrollment.enrolledDate || "";
  if (columnId === "baseFee") return enrollment.baseFee != null ? String(enrollment.baseFee) : "";
  if (columnId === "discountType") return enrollment.discountType || "";
  if (columnId === "discountLabel") return enrollment.discountLabel || "";
  if (columnId === "discountPct")
    return enrollment.discountPct != null ? String(enrollment.discountPct) : "";
  if (columnId === "discountAmt")
    return enrollment.discountAmt != null ? String(enrollment.discountAmt) : "";
  if (columnId === "finalFee")
    return enrollment.finalFee != null ? String(enrollment.finalFee) : "";
  if (columnId === "status") return String(enrollment.status || "");
  if (columnId === "paymentStatus") return String(enrollment.paymentStatus || "");
  if (columnId === "invoiceId") return enrollment.invoiceId || "";
  if (columnId === "notes") return enrollment.notes || "";
  if (columnId === "timelineCount") return String((enrollment.timeline ?? []).length);
  if (columnId === "timelineSummary") {
    return (enrollment.timeline ?? []).map((t) => `${t.ts}: ${t.event} (${t.by})`).join("; ");
  }
  if (columnId === "createdAt") return enrollment.createdAt || "";
  if (columnId === "updatedAt") return enrollment.updatedAt || "";

  const propKey = columnId.startsWith("custom:") ? columnId.slice("custom:".length) : columnId;
  const customObj = (enrollment as { customFields?: Record<string, unknown> }).customFields;
  const cellVal = Reflect.get(enrollment, propKey) ?? customObj?.[propKey] ?? customObj?.[columnId];
  if (cellVal === undefined || cellVal === null) return "";
  if (typeof cellVal === "boolean") return cellVal ? "true" : "false";
  if (typeof cellVal === "number") return cellVal;
  if (typeof cellVal === "string") return cellVal;
  if (Array.isArray(cellVal)) return cellVal.map(String).filter(Boolean).join("; ");
  if (typeof cellVal === "object") return JSON.stringify(cellVal);
  return String(cellVal);
}

/** Builds a 2D grid [header, ...rows] for the given enrollments and columns. */
export function buildEnrollmentsExportRows(
  enrollments: Enrollment[],
  columns: EnrollmentExportColumn[],
): unknown[][] {
  return buildExportGrid(enrollments, columns as ExportColumn[], extractEnrollmentCell);
}
