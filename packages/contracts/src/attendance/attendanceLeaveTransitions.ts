import type { AttendanceLeaveStatus } from "./attendanceModuleManifest.js";

/**
 * Excuse / leave request lifecycle.
 *
 * `pending` is the only state a submission may start in; a reviewer decides once (approve/reject),
 * and an approved leave may be revoked (cancelled). `rejected` and `cancelled` are terminal — a
 * parent must submit a new request rather than silently reviving a decided one, so the audit trail
 * stays a sequence of explicit decisions.
 */
export const ATTENDANCE_LEAVE_TRANSITIONS: Record<
  AttendanceLeaveStatus,
  readonly AttendanceLeaveStatus[]
> = {
  pending: ["pending", "approved", "rejected", "cancelled"],
  approved: ["approved", "cancelled"],
  rejected: ["rejected"],
  cancelled: ["cancelled"],
};

/** True when `to` may replace `from` on a leave request. */
export function canTransitionAttendanceLeave(
  from: AttendanceLeaveStatus | null | undefined,
  to: AttendanceLeaveStatus,
): boolean {
  if (!from) return to === "pending";
  return ATTENDANCE_LEAVE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** A decision changes the state for good (approve, reject or revoke). */
export function isAttendanceLeaveDecision(to: AttendanceLeaveStatus): boolean {
  return to === "approved" || to === "rejected";
}

/** Approved leave is the only state that excuses marks and excludes days from rates. */
export function isAttendanceLeaveEffective(status: AttendanceLeaveStatus | string): boolean {
  return String(status).trim().toLowerCase() === "approved";
}
