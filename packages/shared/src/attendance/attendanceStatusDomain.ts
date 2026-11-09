import { z } from "zod";

/**
 * The attendance status domain — the single leaf module every other definition derives from.
 *
 * It deliberately imports nothing: the manifest, the API schemas, the lookup display model, the
 * matrix and the policy all depend on this file, and an earlier version had them depend on each other
 * (a runtime import cycle that made the status enum `undefined` at module init).
 */

/**
 * Canonical value order. The database CHECK (`attendance_status_check`), the zod enums, the matrix
 * codes and the status lookups must all agree with it; `attendanceStatusParity.test.ts` asserts that.
 */
export const ATTENDANCE_RECORD_STATUSES = [
  "present",
  "absent",
  "late",
  "half_day",
  "excused",
] as const;

export type AttendanceRecordStatus = (typeof ATTENDANCE_RECORD_STATUSES)[number];

/**
 * Statuses that count as attendance in every rate (completion, reports, eligibility).
 *
 * `half_day` is a half-attended day: it credits the day once (no fractional arithmetic) and stays a
 * distinct value for reporting, exactly like `late`.
 */
export const ATTENDANCE_ATTENDED_STATUSES = ["present", "late", "half_day"] as const;
export type AttendanceAttendedStatus = (typeof ATTENDANCE_ATTENDED_STATUSES)[number];

export function isAttendedStatus(value: unknown): value is AttendanceAttendedStatus {
  return (
    typeof value === "string" && (ATTENDANCE_ATTENDED_STATUSES as readonly string[]).includes(value)
  );
}

/** `half_day` is a deliberate partial-attendance mark, not an absence. */
export function isPresentStatus(value: unknown): value is "present" | "late" | "half_day" {
  return isAttendedStatus(value);
}

export const attendanceRecordStatusSchema = z.enum(ATTENDANCE_RECORD_STATUSES);
/** The rate-crediting subset, for policies and filters that only care about attendance. */
export const attendanceAttendedStatusSchema = z.enum(ATTENDANCE_ATTENDED_STATUSES);
