import type { AttendanceRecord } from "./attendanceModuleManifest.js";
import { buildExportGrid } from "../dataTransfer/export/buildExportGrid.js";
import type { ExportColumn } from "../dataTransfer/core/exportTypes.js";

/**
 * Attendance export column catalog (CSV headers + row mapping).
 *
 * Kept beside the manifest rather than in the worker: the export job, the route's column allowlist
 * and any future UI column picker must agree on one list, and a client must not be able to inject an
 * arbitrary header through `columns`.
 */

export interface AttendanceExportColumn {
  id: string;
  label: string;
}

export const ATTENDANCE_DEFAULT_EXPORT_COLUMNS: readonly AttendanceExportColumn[] = [
  { id: "date", label: "Date" },
  { id: "studentName", label: "Student" },
  { id: "studentId", label: "Student ID" },
  { id: "rollNo", label: "Roll No" },
  { id: "status", label: "Status" },
  { id: "timeIn", label: "Time In" },
  { id: "timeOut", label: "Time Out" },
  { id: "notes", label: "Notes" },
  { id: "classId", label: "Class" },
  { id: "sessionName", label: "Session" },
  { id: "sectionId", label: "Section" },
  { id: "markedBy", label: "Marked By" },
  { id: "updatedAt", label: "Updated At" },
] as const;

export const ALL_ATTENDANCE_EXPORT_COLUMNS = ATTENDANCE_DEFAULT_EXPORT_COLUMNS;

const COLUMN_IDS = new Set(ATTENDANCE_DEFAULT_EXPORT_COLUMNS.map((column) => column.id));

/** Resolves the export columns, dropping anything outside the catalog. */
export function resolveAttendanceExportColumns(
  requested?: ReadonlyArray<{ id?: string; label: string }> | null,
): AttendanceExportColumn[] {
  if (!requested || requested.length === 0) return [...ATTENDANCE_DEFAULT_EXPORT_COLUMNS];
  const known = new Set(
    requested
      .map((column) => column.id?.trim())
      .filter((id): id is string => Boolean(id) && COLUMN_IDS.has(id as string)),
  );
  const resolved = ATTENDANCE_DEFAULT_EXPORT_COLUMNS.filter((column) => known.has(column.id));
  return resolved.length > 0 ? resolved : [...ATTENDANCE_DEFAULT_EXPORT_COLUMNS];
}

function cellValue(record: AttendanceRecord, id: string): string {
  switch (id) {
    case "date":
      return record.date ?? "";
    case "studentName":
      return record.studentName ?? "";
    case "studentId":
      return record.studentId ?? "";
    case "rollNo":
      return record.rollNo ?? "";
    case "status":
      return record.status ?? "";
    case "timeIn":
      return record.timeIn ?? "";
    case "timeOut":
      return record.timeOut ?? "";
    case "notes":
      return record.notes ?? "";
    case "classId":
      return record.classId ?? "";
    case "sessionName":
      return record.sessionName ?? "";
    case "sectionId":
      return record.sectionId ?? "";
    case "markedBy":
      return record.markedBy ?? "";
    case "updatedAt":
      return record.updatedAt ?? "";
    default:
      return "";
  }
}

/** Grid rows with the header row first, exactly like every other module export. */
export function buildAttendanceExportRows(
  records: readonly AttendanceRecord[],
  columns: readonly AttendanceExportColumn[],
): unknown[][] {
  return buildExportGrid([...records], columns as ExportColumn[], extractAttendanceCell);
}

/** Cell extractor used by the JSON/XLSX paths. */
export function extractAttendanceCell(
  record: AttendanceRecord,
  columnId: string,
): string | null | undefined {
  if (!COLUMN_IDS.has(columnId)) return undefined;
  return cellValue(record, columnId);
}
