import { randomUUID } from "node:crypto";
import { isNull, sql } from "drizzle-orm";
import type { AttendanceRecord } from "@mms/shared";
import { attendance } from "../schema.js";
import { ConflictError, ValidationError } from "../../lib/httpErrors.js";

/**
 * Planning helpers for the attendance upsert.
 *
 * Split out of `attendanceRepository.ts` for the 300-line band (mms-structure-naming §3) and,
 * more importantly, so the ordering/dedup rules that keep concurrent roster saves safe are pure
 * functions with direct unit tests — they need no database.
 */

/**
 * The business key of a mark — one row per student, class and day.
 *
 * Deliberately excludes `section_id`: the section is stamped from the student's placement on the
 * attendance date, so including it would let a mid-term transfer produce a second mark for the
 * same day. This key, not the surrogate `id`, is what the partial unique index enforces, so it is
 * also the correct `ON CONFLICT` arbiter.
 */
export function attendanceNaturalKey(record: {
  classId?: string | null;
  studentId?: string | null;
  date?: string | null;
}): string {
  const classId = String(record.classId ?? "").trim();
  const studentId = String(record.studentId ?? "").trim();
  const day = String(record.date ?? "").slice(0, 10);
  return `${classId}|${studentId}|${day}`;
}

/** OCC arbiter: the columns of `attendance_workspace_class_student_date_on_uidx`. */
export const ATTENDANCE_NATURAL_KEY_TARGET = [
  attendance.workspaceSubdomain,
  attendance.classId,
  attendance.studentId,
  attendance.date,
];

/** Columns rewritten on a conflict — never `id`, which is the row's stable identity for clients. */
export const ATTENDANCE_UPSERT_SET = {
  studentName: sql`excluded.student_name`,
  status: sql`excluded.status`,
  timeIn: sql`excluded.time_in`,
  timeOut: sql`excluded.time_out`,
  notes: sql`excluded.notes`,
  markedBy: sql`excluded.marked_by`,
  sectionId: sql`excluded.section_id`,
  updatedAt: sql`now()`,
  version: sql`${attendance.version} + 1`,
};

/** The conflict arbiter's predicate — must mirror the partial unique index exactly. */
export const ATTENDANCE_LIVE_ONLY = isNull(attendance.deletedAt);

/** Per-row OCC predicate: only rows whose token still matches the caller's are written. */
export const ATTENDANCE_VERSION_MATCH = sql`${attendance.deletedAt} is null and ${attendance.version} = excluded.version`;

export function attendanceStaleWriteError(record: {
  studentId?: string | null;
  date?: string | null;
}): ConflictError {
  return new ConflictError(
    `Attendance for student ${record.studentId ?? "?"} on ${record.date ?? "?"} was changed by someone else — reload the roster and retry`,
    "stale_write",
  );
}

export interface PlannedAttendanceUpsert {
  /** Rows carrying the caller's OCC token; written under {@link ATTENDANCE_VERSION_MATCH}. */
  withToken: AttendanceRecord[];
  /** Legacy rows without a token; last-writer-wins, but `version` still advances. */
  withoutToken: AttendanceRecord[];
}

/**
 * Normalizes a marked roster into the two upsert buckets.
 *
 * - **Dedupe by business key, not by id.** A duplicate key inside one `INSERT … ON CONFLICT`
 *   raises `21000` ("cannot affect row a second time"); the last row for a key wins, matching the
 *   order the grid sent them in.
 * - **Sort by business key.** `ON CONFLICT DO UPDATE` locks rows as it meets them, so two staff
 *   members saving the same roster in different orders could take those locks in opposite order
 *   and deadlock (`40P01`). A deterministic order removes the cycle.
 * - **Reject one id used for two keys.** The insert would hit the primary key instead of the
 *   natural key, and a driver-level `23505` is not actionable for the caller.
 */
export function planAttendanceUpsert(
  records: AttendanceRecord[],
  idGenerator: () => string = () => `att-${randomUUID()}`,
): PlannedAttendanceUpsert {
  const byNaturalKey = new Map<string, AttendanceRecord>();
  for (const record of records) {
    const rawId = typeof record.id === "string" && record.id.trim() !== "" ? record.id.trim() : "";
    byNaturalKey.set(attendanceNaturalKey(record), {
      ...record,
      id: rawId || idGenerator(),
    });
  }

  const ordered = [...byNaturalKey.values()].sort((a, b) =>
    attendanceNaturalKey(a).localeCompare(attendanceNaturalKey(b)),
  );

  const seenIds = new Set<string>();
  for (const record of ordered) {
    const id = String(record.id);
    if (seenIds.has(id)) {
      throw new ValidationError(
        `Attendance id ${id} was used for more than one student/day in the same save`,
      );
    }
    seenIds.add(id);
  }

  return {
    withToken: ordered.filter((record) => typeof record.version === "number"),
    withoutToken: ordered.filter((record) => typeof record.version !== "number"),
  };
}
