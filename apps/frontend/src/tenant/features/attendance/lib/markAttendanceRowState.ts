import type { ModuleCustomField } from "@mms/shared";
import type { AttendanceRecord } from "@/lib/data/attendanceData";
import type { AttendanceRow } from "@/tenant/features/attendance/lib/markAttendanceTypes";
import {
  attendanceRowsFromRecords,
  buildDefaultRows,
  enrolledStudentsForClass,
  existingRecordsForRoster,
} from "@/tenant/features/attendance/lib/markAttendanceRowUtils";
import type { ClassStudent } from "@/lib/data/attendanceData";

/** Immutable snapshot of a row's persisted fields + server identity (dirty detection baseline). */
export interface RowBaseline {
  status: AttendanceRow["status"];
  timeIn: string;
  timeOut: string;
  notes: string;
  recordId?: string;
  version?: number;
}

export function baselineOf(row: AttendanceRow): RowBaseline {
  return {
    status: row.status,
    timeIn: row.timeIn,
    timeOut: row.timeOut,
    notes: row.notes,
    ...(row.recordId ? { recordId: row.recordId } : {}),
    ...(typeof row.version === "number" ? { version: row.version } : {}),
  };
}

export function rowMatchesBaseline(row: AttendanceRow, baseline: RowBaseline | undefined): boolean {
  if (!baseline) return false;
  return (
    row.status === baseline.status &&
    (row.timeIn || "") === (baseline.timeIn || "") &&
    (row.timeOut || "") === (baseline.timeOut || "") &&
    (row.notes || "") === (baseline.notes || "")
  );
}

/** Keeps custom (non-persisted) field values from the local row when adopting a server row. */
export function pickLocalExtras(
  local: AttendanceRow,
  server: AttendanceRow,
): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(local)) {
    if (!(key in server)) extras[key] = value;
  }
  return extras;
}

/**
 * Merges a fresh server snapshot into the editable rows without clobbering local edits.
 *
 * - clean rows adopt the server value (and refresh their baseline),
 * - dirty rows keep their edits and drop their OCC token when the server moved past the baseline,
 * - the same array reference is returned when nothing changed, so callers can `setRows` safely.
 */
export function mergeServerRows(args: {
  currentRows: AttendanceRow[];
  serverRecords: AttendanceRecord[];
  baseline: Map<string, RowBaseline>;
}): { rows: AttendanceRow[]; conflicts: number; changed: boolean } {
  const { currentRows, serverRecords, baseline } = args;
  const serverByStudent = new Map(serverRecords.map((record) => [record.studentId, record]));
  let conflicts = 0;
  let changed = false;
  const rows = currentRows.map((row) => {
    const rowBaseline = baseline.get(row.studentId);
    const clean = rowMatchesBaseline(row, rowBaseline);
    const serverRecord = serverByStudent.get(row.studentId);
    if (clean) {
      if (!serverRecord) return row;
      const next = attendanceRowsFromRecords([serverRecord])[0];
      if (!next) return row;
      baseline.set(row.studentId, baselineOf(next));
      changed = true;
      return { ...next, ...pickLocalExtras(row, next) };
    }
    if (serverRecord && (serverRecord.version ?? undefined) !== rowBaseline?.version) {
      conflicts += 1;
      if (row.version !== undefined) {
        const { version: _dropped, ...rest } = row;
        changed = true;
        return rest as AttendanceRow;
      }
    }
    return row;
  });
  return { rows: changed ? rows : currentRows, conflicts, changed };
}

/** Rows to show when a roster is (re)seeded: existing server marks, else defaults for the roster. */
export function seedRowsFor(args: {
  records: AttendanceRecord[];
  filters: { classId: string; date: string; sectionId?: string };
  students: ClassStudent[];
  customFields: ModuleCustomField[];
}): AttendanceRow[] {
  const existing = existingRecordsForRoster(args.records, args.filters, args.students);
  return existing.length > 0
    ? attendanceRowsFromRecords(existing)
    : buildDefaultRows(args.students, args.customFields);
}

/** Adopts the server's persisted rows (ids + OCC versions) and refreshes the dirty baseline. */
export function applyPersistedRows(args: {
  currentRows: AttendanceRow[];
  persisted: AttendanceRecord[];
  baseline: Map<string, RowBaseline>;
}): AttendanceRow[] {
  const { currentRows, persisted, baseline } = args;
  if (persisted.length === 0) return currentRows;
  const byStudent = new Map(persisted.map((record) => [record.studentId, record]));
  return currentRows.map((row) => {
    const serverRecord = byStudent.get(row.studentId);
    if (!serverRecord) return row;
    const next = attendanceRowsFromRecords([serverRecord])[0];
    if (!next) return row;
    baseline.set(row.studentId, baselineOf(next));
    return { ...next, ...pickLocalExtras(row, next) };
  });
}

/** Rows matching the grid's local search box. */
export function filterRowsByName(rows: AttendanceRow[], search: string): AttendanceRow[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => row.name.toLowerCase().includes(needle));
}

/** Status histogram for the stats strip. */
export function computeRosterStats(rows: AttendanceRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = (counts[row.status] || 0) + 1;
  return counts;
}

/** The class roster (section/date aware) the grid marks. */
export function resolveRosterStudents(args: {
  classId: string;
  sectionId?: string;
  date: string;
  enrollments: Parameters<typeof enrolledStudentsForClass>[1];
  students: Parameters<typeof enrolledStudentsForClass>[2];
  fallbackName: string;
}): ClassStudent[] {
  if (!args.classId) return [];
  return enrolledStudentsForClass(
    args.classId,
    args.enrollments,
    args.students,
    args.fallbackName,
    args.sectionId,
    args.date,
  );
}

/** Immutably sets one row's status (keyboard marking). */
export function setRowStatus(
  rows: AttendanceRow[],
  studentId: string,
  status: AttendanceRow["status"],
): AttendanceRow[] {
  return rows.map((row) => (row.studentId === studentId ? { ...row, status } : row));
}

/** One stable token per server row: identity + OCC version + status. */
export function rowSignature(record: AttendanceRecord): string {
  return `${record.studentId}:${record.version ?? ""}:${record.status}`;
}
