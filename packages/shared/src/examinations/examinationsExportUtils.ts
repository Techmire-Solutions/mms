import type { Exam } from "./examinationsModuleManifest.js";
import { buildExportGrid } from "../dataTransfer/export/buildExportGrid.js";

/**
 * Examinations export column catalogue (CSV headers + row mapping).
 *
 * Kept beside the manifest so the CSV export job, the route's column allowlist and any future
 * column picker agree on one list — a client must not be able to inject an arbitrary header
 * through `columns`. The catalogue is the exam record, not its marks: the CSV import round-trips
 * exam metadata, and marks leave the system only through the marks API.
 */

export interface ExaminationsExportColumn {
  id: string;
  label: string;
}

export const EXAMINATIONS_DEFAULT_EXPORT_COLUMNS: readonly ExaminationsExportColumn[] = [
  { id: "name", label: "Exam" },
  { id: "subject", label: "Subject" },
  { id: "date", label: "Date" },
  { id: "totalMarks", label: "Total Marks" },
  { id: "passingMarks", label: "Passing Marks" },
  { id: "status", label: "Status" },
  { id: "classes", label: "Classes" },
  { id: "resultsFinalizedAt", label: "Results Published At" },
  { id: "createdAt", label: "Created At" },
  { id: "updatedAt", label: "Updated At" },
] as const;

export const ALL_EXAMINATIONS_EXPORT_COLUMNS = EXAMINATIONS_DEFAULT_EXPORT_COLUMNS;

const COLUMN_IDS = new Set(EXAMINATIONS_DEFAULT_EXPORT_COLUMNS.map((column) => column.id));

/** Resolves requested columns against the catalogue; unknown ids are dropped. */
export function resolveExaminationsExportColumns(
  requested?: ReadonlyArray<{ id?: string; label: string }> | null,
): ExaminationsExportColumn[] {
  if (!requested || requested.length === 0) return [...EXAMINATIONS_DEFAULT_EXPORT_COLUMNS];
  const known = new Set(
    requested
      .map((column) => column.id?.trim())
      .filter((id): id is string => Boolean(id) && COLUMN_IDS.has(id as string)),
  );
  const resolved = EXAMINATIONS_DEFAULT_EXPORT_COLUMNS.filter((column) => known.has(column.id));
  return resolved.length > 0 ? resolved : [...EXAMINATIONS_DEFAULT_EXPORT_COLUMNS];
}

function cellValue(exam: Exam, id: string): string {
  switch (id) {
    case "name":
      return exam.name ?? "";
    case "subject":
      return exam.subject ?? "";
    case "date":
      return exam.date ?? "";
    case "totalMarks":
      return String(exam.totalMarks ?? "");
    case "passingMarks":
      return String(exam.passingMarks ?? "");
    case "status":
      return exam.status ?? "";
    case "classes":
      return (exam.classIds ?? []).join(" | ");
    case "resultsFinalizedAt":
      return exam.resultsFinalizedAt ?? "";
    case "createdAt":
      return exam.createdAt ?? "";
    case "updatedAt":
      return exam.updatedAt ?? "";
    default:
      return "";
  }
}

/** Cell extractor for the JSON/XLSX paths. */
export function extractExaminationsCell(exam: Exam, columnId: string): string | null | undefined {
  if (!COLUMN_IDS.has(columnId)) return undefined;
  return cellValue(exam, columnId);
}

/** Grid rows with the header row first, matching every other module export. */
export function buildExaminationsExportRows(
  exams: readonly Exam[],
  columns: readonly ExaminationsExportColumn[],
): unknown[][] {
  return buildExportGrid([...exams], [...columns], extractExaminationsCell);
}
