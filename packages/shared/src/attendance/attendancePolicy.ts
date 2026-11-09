import {
  ATTENDANCE_RECORD_STATUSES,
  type AttendanceRecordStatus,
} from "./attendanceModuleManifest.js";
import type { AttendanceModulePreferences } from "./attendanceSetupPreferences.js";

/**
 * Attendance write policy — the single place the module's configurable rules are turned into a
 * decision.
 *
 * Every write path (single create, single correction, bulk roster save, CSV import) runs through
 * {@link evaluateAttendanceWrite}; nothing else may re-implement these rules. The function is pure
 * so the matrix is unit-tested without a database.
 *
 * Timing reference: `cutoffTime` is the daily arrival deadline, `lateThresholdMins` is the grace
 * after it. Attendance has no period dimension, so timetable period start times are not consulted.
 */

export type AttendancePolicyErrorCode =
  | "attendance_cutoff_passed"
  | "attendance_day_locked"
  | "attendance_late_threshold"
  | "attendance_note_required"
  | "attendance_on_approved_leave"
  | "attendance_time_invalid";

export interface AttendancePolicyError {
  code: AttendancePolicyErrorCode;
  /** HTTP status the transport layer must map this to. */
  status: number;
  message: string;
  studentId?: string;
  date?: string;
}

export interface AttendancePolicyRow {
  classId: string;
  studentId: string;
  date: string;
  status: AttendanceRecordStatus;
  timeIn?: string | null;
  timeOut?: string | null;
  notes?: string | null;
}

export interface AttendancePolicyContext {
  /** Workspace-local today (`YYYY-MM-DD`). */
  today: string;
  /** Workspace-local clock (`HH:mm`) at the moment of the write. */
  nowTime: string;
  /**
   * May the caller waive the cutoff / submitted-day / approved-leave rules?
   * Resolved by the guard as `permissions.users.manage || preferences.allowManualOverride`.
   */
  canOverride: boolean;
  /** Existing row for the same business key, when this write corrects one. */
  existing?: AttendancePolicyRow | null;
  /** True when an approved leave covers (studentId, date). */
  isApprovedLeave?: (row: AttendancePolicyRow) => boolean;
  /** True when the roster for (classId, date) has been submitted. */
  isDaySubmitted?: (row: AttendancePolicyRow) => boolean;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Minutes since midnight for `HH:mm`; `null` for anything else. */
export function hhmmToMinutes(value: string | null | undefined): number | null {
  const match = HHMM.exec((value ?? "").trim());
  if (!match) return null;
  const [hours, minutes] = match[0].split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** `HH:mm` for minutes since midnight (wraps within the day). */
export function minutesToHhmm(minutes: number): string {
  const bounded = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(bounded / 60)).padStart(2, "0")}:${String(bounded % 60).padStart(2, "0")}`;
}

/** Add `delta` minutes to an `HH:mm` value, or `null` when the input is not a time. */
export function addMinutesToHhmm(value: string, delta: number): string | null {
  const minutes = hhmmToMinutes(value);
  return minutes === null ? null : minutesToHhmm(minutes + delta);
}

/** True when `nowTime` on `day` is at or past the day's cut-off. */
export function isPastAttendanceCutoff(
  day: string,
  today: string,
  nowTime: string,
  cutoffTime: string,
): boolean {
  if (!day) return false;
  if (day < today) return true; // any earlier day is closed
  if (day > today) return false; // future days are not restricted
  const cutoff = hhmmToMinutes(cutoffTime);
  const now = hhmmToMinutes(nowTime);
  if (cutoff === null || now === null) return false;
  return now > cutoff;
}

/**
 * Evaluates one attendance row.
 *
 * Returns every violation for the row (the caller reports the first, or aggregates for a batch).
 */
export function evaluateAttendanceWrite(
  row: AttendancePolicyRow,
  preferences: AttendanceModulePreferences,
  context: AttendancePolicyContext,
): AttendancePolicyError[] {
  const errors: AttendancePolicyError[] = [];
  const { status, timeIn, timeOut, notes } = row;
  const base = { studentId: row.studentId, date: row.date };

  // ── P5 time-field sanity (always on; a broken time is never a valid evidence row) ──────────
  const inMinutes = hhmmToMinutes(timeIn);
  const outMinutes = hhmmToMinutes(timeOut);
  // A `late` mark without a time is meaningless. `present` deliberately does not require one:
  // `attendanceRecordInsertSchema` defaults `timeIn` to "" and schools use present as a one-tap mark,
  // so requiring a time there would reject the module's own documented minimal create.
  if (status === "late" && inMinutes === null) {
    errors.push({
      ...base,
      code: "attendance_time_invalid",
      status: 400,
      message: `${row.date}: a late mark needs a valid time-in (HH:mm)`,
    });
  }
  if (
    (status === "absent" || status === "excused") &&
    (inMinutes !== null || outMinutes !== null)
  ) {
    errors.push({
      ...base,
      code: "attendance_time_invalid",
      status: 400,
      message: `${row.date}: an ${status} mark cannot carry arrival times`,
    });
  }
  if (inMinutes !== null && outMinutes !== null && outMinutes < inMinutes) {
    errors.push({
      ...base,
      code: "attendance_time_invalid",
      status: 400,
      message: `${row.date}: time-out (${timeOut}) is before time-in (${timeIn})`,
    });
  }

  // ── P3 note requirement ───────────────────────────────────────────────────────────────────
  if (
    preferences.requireNoteForAbsent &&
    (status === "absent" || status === "excused") &&
    !String(notes ?? "").trim()
  ) {
    errors.push({
      ...base,
      code: "attendance_note_required",
      status: 409,
      message: `${row.date}: this school requires a note when marking a student ${status}`,
    });
  }

  // ── P4 approved leave wins over attendance ────────────────────────────────────────────────
  const onLeave = context.isApprovedLeave?.(row) === true;
  if (onLeave && (status === "present" || status === "late") && !context.canOverride) {
    errors.push({
      ...base,
      code: "attendance_on_approved_leave",
      status: 409,
      message: `${row.date}: the student has approved leave — mark the day excused (or override)`,
    });
  }

  // ── P2 late grace ─────────────────────────────────────────────────────────────────────────
  // A "present" mark later than cutoff + grace is a late arrival the policy wants recorded as late.
  const cutoffMinutes = hhmmToMinutes(preferences.cutoffTime);
  if (status === "present" && inMinutes !== null && cutoffMinutes !== null) {
    const boundaryMinutes = cutoffMinutes + preferences.lateThresholdMins;
    if (boundaryMinutes < 1440 && inMinutes > boundaryMinutes) {
      const lateBoundary = minutesToHhmm(boundaryMinutes);
      errors.push({
        ...base,
        code: "attendance_late_threshold",
        status: 409,
        message: `${row.date}: arrival at ${timeIn} is past the late threshold (${lateBoundary}) — mark the student late`,
      });
    }
  }

  // ── P6 submitted day ──────────────────────────────────────────────────────────────────────
  const submitted = context.isDaySubmitted?.(row) === true;
  if (submitted && preferences.lockAfterSubmit && !context.canOverride) {
    errors.push({
      ...base,
      code: "attendance_day_locked",
      status: 409,
      message: `${row.date}: attendance for this class was submitted and is locked`,
    });
  }

  // ── P1 cut-off ────────────────────────────────────────────────────────────────────────────
  if (
    !context.canOverride &&
    isPastAttendanceCutoff(row.date, context.today, context.nowTime, preferences.cutoffTime)
  ) {
    errors.push({
      ...base,
      code: "attendance_cutoff_passed",
      status: 409,
      message: `${row.date}: the ${preferences.cutoffTime} marking cut-off has passed — an administrator must override`,
    });
  }

  return errors;
}

/** Convenience: the first violation, or `null`. */
export function firstAttendancePolicyError(
  errors: readonly AttendancePolicyError[],
): AttendancePolicyError | null {
  return errors[0] ?? null;
}

/** Guard used by the policy evaluator and the preferences schema. */
export function isAttendanceRecordStatus(value: unknown): value is AttendanceRecordStatus {
  return (
    typeof value === "string" && (ATTENDANCE_RECORD_STATUSES as readonly string[]).includes(value)
  );
}
