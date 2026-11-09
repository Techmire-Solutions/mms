import { HttpDomainError } from "../../lib/httpErrors.js";
import type { AttendancePolicyError } from "@mms/shared";
import type { AttendanceCalendarRepository } from "../repository/attendanceCalendarRepository.js";

/**
 * Shared policy primitives for the attendance write gates.
 *
 * Kept in their own module so the roster-write gate and the delete/restore gate share one definition
 * of the store port, of what an override means, and of the justification rule.
 */

/** The slice of the calendar/leave/submission store the policy needs. */
export type AttendancePolicyStore = Pick<
  AttendanceCalendarRepository,
  | "getAttendanceModulePreferences"
  | "findWorkspaceTimezone"
  | "listApprovedLeavesFor"
  | "listLockedAttendanceDayKeys"
  | "lockAttendanceStudents"
>;

/** What a permitted operation had to override, so the caller can tag its audit row. */
export interface AttendanceOverrideSummary {
  overridden: boolean;
  /** Policy codes the override bypassed (`attendance_day_locked`, `attendance_cutoff_passed`). */
  codes: string[];
}

/** The only rules a delete-level override may bypass; everything else still fails. */
export const OVERRIDABLE_CODES = new Set(["attendance_day_locked", "attendance_cutoff_passed"]);

export function toDomainError(error: AttendancePolicyError): HttpDomainError {
  return new HttpDomainError(error.status, error.code, error.message);
}

/** A justification is mandatory whenever an override is actually used. */
export function requireOverrideReason(reason: string | null | undefined, codes: string[]): string {
  const trimmed = (reason ?? "").trim();
  if (trimmed.length < 3) {
    throw new HttpDomainError(
      422,
      "attendance_override_reason_required",
      `${codes.join(", ")}: an administrator must give a reason to override this attendance write`,
    );
  }
  return trimmed;
}
