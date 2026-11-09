import {
  ATTENDANCE_MATRIX_MAX_CELLS,
  attendanceMatrixDates,
  buildCsvContent,
  buildAttendanceMatrixChunk,
  buildAttendanceMatrixFooter,
  type AttendanceMatrixStatus,
  type AttendanceMatrixTotals,
  type AttendanceMatrixStudent,
} from "@mms/shared";
import { getRequestTenant } from "../lib/tenantContext.js";
import { attendanceRepository } from "../attendance/repository/attendanceRepositoryAdapter.js";

type MatrixStudent = { studentId: string; studentName: string; rollNo: string };
const listMatrixStudentsPage = attendanceRepository.listMatrixStudentsPage;
const listMatrixMarks = attendanceRepository.listMatrixMarks;

/**
 * Register / monthly-matrix export.
 *
 * The matrix is built **student chunk by student chunk**: the roster is read 100 students at a time,
 * their marks for the range are fetched for just that chunk, the chunk is serialised, and it is
 * released before the next one. Peak memory is therefore `chunkSize × days`, not
 * `students × days`; the caller (a background job) writes each chunk to storage with backpressure.
 */

export interface MatrixExportRequest {
  classId: string;
  sectionId?: string;
  dateFrom: string;
  dateTo: string;
}

export interface MatrixExportMeta {
  tenant: string;
  className?: string;
  sectionName?: string;
}

const STUDENT_CHUNK_SIZE = 100;
const VALID_STATUSES = new Set<AttendanceMatrixStatus>(["present", "late", "absent", "excused"]);

function requireTenant(): string {
  const tenant = getRequestTenant()?.trim().toLowerCase();
  if (!tenant) throw new Error("Tenant context is required for a matrix export");
  return tenant;
}

function toMatrixStudent(
  student: MatrixStudent,
  marksByStudent: Map<string, Map<string, AttendanceMatrixStatus>>,
) {
  return {
    studentId: student.studentId,
    studentName: student.studentName,
    rollNo: student.rollNo,
    marks: marksByStudent.get(student.studentId) ?? new Map<string, AttendanceMatrixStatus>(),
  } satisfies AttendanceMatrixStudent;
}

function groupMarks(
  marks: ReadonlyArray<{ studentId: string; date: string; status: string }>,
): Map<string, Map<string, AttendanceMatrixStatus>> {
  const byStudent = new Map<string, Map<string, AttendanceMatrixStatus>>();
  for (const mark of marks) {
    const status = mark.status.trim().toLowerCase() as AttendanceMatrixStatus;
    if (!VALID_STATUSES.has(status)) continue;
    const days = byStudent.get(mark.studentId) ?? new Map<string, AttendanceMatrixStatus>();
    days.set(mark.date, status);
    byStudent.set(mark.studentId, days);
  }
  return byStudent;
}

/** Validated range or a 400-style domain error message. */
export function resolveMatrixDates(
  request: MatrixExportRequest,
): { ok: true; dates: string[] } | { ok: false; message: string } {
  const resolved = attendanceMatrixDates(request.dateFrom, request.dateTo);
  if (!resolved.ok) return { ok: false, message: resolved.reason };
  return { ok: true, dates: resolved.dates };
}

/** Applies the cell ceiling for materialised formats. */
export function assertMatrixCellBudget(dates: readonly string[], rosterSize: number): void {
  const cells = dates.length * Math.max(rosterSize, 1);
  if (cells > ATTENDANCE_MATRIX_MAX_CELLS) {
    const error = new Error(
      `This register needs ${cells} cells (limit ${ATTENDANCE_MATRIX_MAX_CELLS}). Narrow the date range or the section.`,
    ) as Error & { statusCode: number; type: string };
    error.statusCode = 413;
    error.type = "payload_too_large";
    throw error;
  }
}

/**
 * Streams the matrix as CSV chunks (header lines + column header once, then the footer).
 *
 * Yields strings; the caller applies storage backpressure.
 */
export async function* generateAttendanceMatrixCsv(
  request: MatrixExportRequest,
  meta: MatrixExportMeta,
): AsyncGenerator<string, { students: number; totals: AttendanceMatrixTotals }, undefined> {
  const tenant = meta.tenant || requireTenant();
  const resolved = resolveMatrixDates(request);
  if (!resolved.ok) {
    const error = new Error(resolved.message) as Error & { statusCode: number; type: string };
    error.statusCode = 400;
    error.type = "validation_error";
    throw error;
  }
  const { dates } = resolved;

  // No preamble rows: the scope lives in the filename, so the sheet is strictly tabular and a
  // hostile class name cannot break the CSV structure.
  const totals: AttendanceMatrixTotals = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    marked: 0,
  };
  const daily = dates.map(() => ({ present: 0, late: 0, absent: 0, excused: 0 }));
  let studentsExported = 0;
  let cursor: string | undefined;
  let withHeader = true;

  for (;;) {
    const page = await listMatrixStudentsPage(tenant, {
      classId: request.classId,
      ...(request.sectionId ? { sectionId: request.sectionId } : {}),
      ...(cursor ? { afterStudentId: cursor } : {}),
      limit: STUDENT_CHUNK_SIZE,
    });
    if (page.students.length === 0) break;

    const marks = await listMatrixMarks(tenant, {
      classId: request.classId,
      studentIds: page.students.map((student) => student.studentId),
      dateFrom: request.dateFrom,
      dateTo: request.dateTo,
    });
    const byStudent = groupMarks(marks);
    const chunk = buildAttendanceMatrixChunk(
      page.students.map((student) => toMatrixStudent(student, byStudent)),
      dates,
      { withHeader },
    );
    withHeader = false;
    studentsExported += page.students.length;
    for (const key of ["present", "late", "absent", "excused"] as const) {
      totals[key] += chunk.totals[key];
    }
    totals.marked += chunk.totals.marked;
    chunk.daily.forEach((day, index) => {
      const target = daily[index]!;
      target.present += day.present;
      target.late += day.late;
      target.absent += day.absent;
      target.excused += day.excused;
    });
    yield `${chunk.csv}\n`;

    if (!page.hasMore) break;
    cursor = page.nextCursor;
  }

  // Footer cells are numeric, but they go through the same escaper as every other cell.
  yield `${buildCsvContent(buildAttendanceMatrixFooter(dates, daily, totals))}\n`;
  return { students: studentsExported, totals };
}

/** Materialised grid for XLSX (bounded by {@link assertMatrixCellBudget}). */
export async function buildAttendanceMatrixGrid(
  request: MatrixExportRequest,
  meta: MatrixExportMeta,
): Promise<unknown[][]> {
  const tenant = meta.tenant || requireTenant();
  const resolved = resolveMatrixDates(request);
  if (!resolved.ok) {
    const error = new Error(resolved.message) as Error & { statusCode: number; type: string };
    error.statusCode = 400;
    error.type = "validation_error";
    throw error;
  }
  const { dates } = resolved;
  const grid: unknown[][] = [];
  const totals: AttendanceMatrixTotals = { present: 0, late: 0, absent: 0, excused: 0, marked: 0 };
  const daily = dates.map(() => ({ present: 0, late: 0, absent: 0, excused: 0 }));
  let cursor: string | undefined;
  let rosterSize = 0;

  for (;;) {
    const page = await listMatrixStudentsPage(tenant, {
      classId: request.classId,
      ...(request.sectionId ? { sectionId: request.sectionId } : {}),
      ...(cursor ? { afterStudentId: cursor } : {}),
      limit: STUDENT_CHUNK_SIZE,
    });
    if (page.students.length === 0) break;
    rosterSize += page.students.length;
    assertMatrixCellBudget(dates, rosterSize);
    const marks = await listMatrixMarks(tenant, {
      classId: request.classId,
      studentIds: page.students.map((student) => student.studentId),
      dateFrom: request.dateFrom,
      dateTo: request.dateTo,
    });
    const byStudent = groupMarks(marks);
    const chunk = buildAttendanceMatrixChunk(
      page.students.map((student) => toMatrixStudent(student, byStudent)),
      dates,
      { withHeader: grid.length === 0 },
    );
    grid.push(...chunk.grid);
    for (const key of ["present", "late", "absent", "excused"] as const) {
      totals[key] += chunk.totals[key];
    }
    totals.marked += chunk.totals.marked;
    chunk.daily.forEach((day, index) => {
      const target = daily[index]!;
      target.present += day.present;
      target.late += day.late;
      target.absent += day.absent;
      target.excused += day.excused;
    });
    if (!page.hasMore) break;
    cursor = page.nextCursor;
  }

  grid.push(...buildAttendanceMatrixFooter(dates, daily, totals));
  return grid;
}
