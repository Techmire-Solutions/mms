import { buildCsvContent } from "../core/csvUtils.js";

/**
 * Attendance register / monthly matrix.
 *
 * A matrix is `students × days`: one row per student, one column per teaching day in the range, plus
 * present/total totals. It is built **per student chunk** by the export service so a 1,000-student
 * term never becomes a single in-memory grid, and every cell goes through `buildCsvContent` →
 * `escapeCsvCell` (formula-injection safe).
 */

/** Longest range a matrix export may cover (a term plus a margin). */
export const ATTENDANCE_MATRIX_MAX_DAYS = 92;
/** Cell ceiling for materialised formats (XLSX). CSV streams and is only day-bounded. */
export const ATTENDANCE_MATRIX_MAX_CELLS = 200_000;

export type AttendanceMatrixStatus = "present" | "late" | "absent" | "excused";

/** One student's row inputs: the marks that exist for the range, keyed by ISO day. */
export interface AttendanceMatrixStudent {
  studentId: string;
  studentName: string;
  rollNo: string;
  marks: ReadonlyMap<string, AttendanceMatrixStatus>;
}

export interface AttendanceMatrixTotals {
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** Days with a mark at all (not the range length). */
  marked: number;
}

/** Single-letter code used in the grid; `—` for a day with no mark. */
const STATUS_CODE: Record<AttendanceMatrixStatus, string> = {
  present: "P",
  late: "L",
  absent: "A",
  excused: "E",
};

export function attendanceMatrixCellCode(status: AttendanceMatrixStatus | undefined): string {
  return status ? STATUS_CODE[status] : "—";
}

/** Header row: Roll No, Student, one column per day (MM-DD), then totals. */
export function buildAttendanceMatrixHeader(dates: readonly string[]): string[] {
  return [
    "Roll No",
    "Student",
    ...dates.map((date) => date.slice(5)),
    "Present",
    "Late",
    "Absent",
    "Excused",
    "Marked",
    "Attendance %",
  ];
}

function percentage(present: number, late: number, marked: number): string {
  if (marked === 0) return "";
  return String(Math.round(((present + late) / marked) * 100));
}

/** One student's row: codes for every day, then the totals block. */
export function buildAttendanceMatrixRow(
  student: AttendanceMatrixStudent,
  dates: readonly string[],
): { cells: string[]; totals: AttendanceMatrixTotals } {
  const totals: AttendanceMatrixTotals = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    marked: 0,
  };
  for (const date of dates) {
    const status = student.marks.get(date);
    if (status) {
      totals[status] += 1;
      totals.marked += 1;
    }
  }
  const cells = [
    student.rollNo,
    student.studentName,
    ...dates.map((date) => attendanceMatrixCellCode(student.marks.get(date))),
    String(totals.present),
    String(totals.late),
    String(totals.absent),
    String(totals.excused),
    String(totals.marked),
    percentage(totals.present, totals.late, totals.marked),
  ];
  return { cells, totals };
}

export interface AttendanceMatrixChunk {
  /** CSV text for this chunk. The header is only included when `withHeader` is true. */
  csv: string;
  /** Grid for materialised formats, header row first. */
  grid: string[][];
  /** Per-day totals of this chunk, for the footer. */
  daily: Array<{ present: number; late: number; absent: number; excused: number }>;
  totals: AttendanceMatrixTotals;
}

/**
 * Builds one chunk. The caller adds the class/range header lines itself; this keeps the per-student
 * section purely tabular (and testable).
 */
export function buildAttendanceMatrixChunk(
  students: readonly AttendanceMatrixStudent[],
  dates: readonly string[],
  options: { withHeader: boolean },
): AttendanceMatrixChunk {
  const daily = dates.map(() => ({ present: 0, late: 0, absent: 0, excused: 0 }));
  const totals: AttendanceMatrixTotals = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    marked: 0,
  };
  const rows: string[][] = [];
  for (const student of students) {
    const { cells, totals: studentTotals } = buildAttendanceMatrixRow(student, dates);
    rows.push(cells);
    for (const key of ["present", "late", "absent", "excused"] as const) {
      totals[key] += studentTotals[key];
    }
    totals.marked += studentTotals.marked;
    dates.forEach((date, index) => {
      const status = student.marks.get(date);
      if (status) daily[index]![status] += 1;
    });
  }
  const grid = options.withHeader ? [buildAttendanceMatrixHeader(dates), ...rows] : rows;
  // `buildCsvContent` escapes every cell (formula injection + quoting).
  return { csv: buildCsvContent(grid), grid, daily, totals };
}

/** Footer with the range's daily totals and the overall counts. */
export function buildAttendanceMatrixFooter(
  dates: readonly string[],
  daily: ReadonlyArray<{ present: number; late: number; absent: number; excused: number }>,
  totals: AttendanceMatrixTotals,
): string[][] {
  return [
    [
      "",
      "Daily totals",
      ...dates.map((_date, index) => {
        const day = daily[index];
        return day ? String(day.present + day.late) : "";
      }),
      String(totals.present),
      String(totals.late),
      String(totals.absent),
      String(totals.excused),
      String(totals.marked),
      percentage(totals.present, totals.late, totals.marked),
    ],
  ];
}

/** Validates a requested range and returns the day list (inclusive). */
export function attendanceMatrixDates(
  from: string,
  to: string,
): { ok: true; dates: string[] } | { ok: false; reason: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { ok: false, reason: "dates must be YYYY-MM-DD" };
  }
  if (to < from) return { ok: false, reason: "dateTo must not be before dateFrom" };
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  const days = Math.round((end - start) / 86_400_000) + 1;
  if (days > ATTENDANCE_MATRIX_MAX_DAYS) {
    return { ok: false, reason: `range exceeds ${ATTENDANCE_MATRIX_MAX_DAYS} days` };
  }
  const dates: string[] = [];
  for (let index = 0; index < days; index += 1) {
    dates.push(new Date(start + index * 86_400_000).toISOString().slice(0, 10));
  }
  return { ok: true, dates };
}
