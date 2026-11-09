import {
  ATTENDANCE_RECORD_STATUSES,
  type AttendanceRecordStatus,
} from "./attendanceModuleManifest.js";

/**
 * Attendance status transitions.
 *
 * There is **no forbidden edge** for an authorised editor: a teacher/admin must be able to correct
 * a mis-mark in either direction (unexcused absent → excused absent is the common case when a
 * guardian produces a reason). What the domain constrains is the *preconditions* for a transition —
 * reason required, cutoff passed, approved leave on the day — which live in `attendancePolicy.ts`.
 *
 * The table exists so a future policy that does restrict an edge has exactly one place to change,
 * and so the review has an explicit statement of intent instead of an absence of code.
 */
/**
 * Built from the canonical status list, so a new status automatically gains its edges instead of
 * breaking the `Record` (which is what caught the missing `half_day`).
 */
export const ATTENDANCE_STATUS_TRANSITIONS: Record<
  AttendanceRecordStatus,
  readonly AttendanceRecordStatus[]
> = Object.fromEntries(
  ATTENDANCE_RECORD_STATUSES.map((status) => [status, [...ATTENDANCE_RECORD_STATUSES]]),
) as unknown as Record<AttendanceRecordStatus, readonly AttendanceRecordStatus[]>;

/** True when `to` may replace `from` for this record. */
export function isAttendanceStatusTransitionAllowed(
  from: AttendanceRecordStatus | null | undefined,
  to: AttendanceRecordStatus,
): boolean {
  if (!from) return true; // new mark — no transition, the policy gate applies instead
  return ATTENDANCE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface AttendanceStatusSnapshot {
  status?: AttendanceRecordStatus | string | null;
  timeIn?: string | null;
  timeOut?: string | null;
  notes?: string | null;
  studentId?: string | null;
}

/** Status actually changed (not just a note/time edit on the same status). */
export function attendanceStatusChanged(
  existing: AttendanceStatusSnapshot | null | undefined,
  incoming: AttendanceStatusSnapshot,
): boolean {
  if (!existing) return true;
  return String(existing.status ?? "") !== String(incoming.status ?? "");
}

/** Every field a client may change on a mark, compared by value. */
export interface AttendanceChangeSnapshot extends AttendanceStatusSnapshot {
  classId?: string | null;
  date?: string | null;
  rollNo?: string | null;
  studentName?: string | null;
  sectionId?: string | null;
}

const CHANGE_FIELDS = [
  "classId",
  "studentId",
  "date",
  "status",
  "timeIn",
  "timeOut",
  "notes",
  "rollNo",
  "studentName",
  "sectionId",
] as const;

function normalise(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * True when the persisted row differs **in any field a client can change**.
 *
 * The bulk save used to audit only `attendanceStatusChanged`, so a corrected time-in, time-out,
 * roll number or note on an unchanged status left no audit row at all — an unlogged modification of
 * attendance evidence. The batch loop now audits any row this reports as changed.
 */
export function attendanceRecordChanged(
  existing: AttendanceChangeSnapshot | null | undefined,
  incoming: AttendanceChangeSnapshot,
): boolean {
  if (!existing) return true;
  return CHANGE_FIELDS.some(
    (field) =>
      normalise((existing as Record<string, unknown>)[field]) !==
      normalise((incoming as Record<string, unknown>)[field]),
  );
}

/** Coarse description of what a write did, for the audit row's action type. */
export function attendanceWriteAction(
  existing: AttendanceStatusSnapshot | null | undefined,
): "attendance.marked" | "attendance.corrected" {
  return existing ? "attendance.corrected" : "attendance.marked";
}
