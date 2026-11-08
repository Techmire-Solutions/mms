import { attendanceCalendarRepository as repo } from "../repository/attendanceCalendarRepositoryAdapter.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import { broadcastCollection } from "../../lib/livePush.js";
import type { AttendanceDaySubmission } from "../repository/attendanceCalendarRepository.js";

/**
 * Attendance-owned writes for approved leave ranges and roster-day submission state.
 *
 * Both are cross-module services: enrollment suspension records leave, and the marking grid
 * submits a day. They do not carry the teacher row-scope (their caller owns authorization).
 */

/**
 * Records an approved leave range (used by enrollment suspension).
 *
 * Approved leave days are excluded from attendance rates by the countable-attendance rule, and the
 * write policy refuses a `present` mark on one. The overlap check and the insert are serialized by
 * a per-student advisory lock inside the repository, so two concurrent suspensions cannot both
 * create an overlapping range.
 */
export async function recordApprovedLeave(
  tenant: string,
  leave: { studentId: string; fromOn: string; toOn: string; reason: string; approvedBy: string },
): Promise<string> {
  const result = await repo.insertApprovedLeaveIfFree(tenant, leave);
  if (!result.ok) {
    throw new ConflictError(
      `The student already has approved leave from ${result.conflict.fromDate} to ${result.conflict.toDate}`,
    );
  }
  await broadcastCollection("attendance");
  return result.id;
}

/**
 * Marks a class/day roster as submitted. Idempotent: submitting an already-submitted day returns the
 * existing state with `alreadySubmitted: true` instead of moving the timestamp (so two taps cannot
 * silently extend the lock).
 */
export async function submitAttendanceDay(
  tenant: string,
  input: { classId: string; date: string; submittedBy: string },
): Promise<{ submission: AttendanceDaySubmission; alreadySubmitted: boolean }> {
  const existing = await repo.getAttendanceDaySubmission(tenant, input.classId, input.date);
  if (existing?.locked) {
    return { submission: existing, alreadySubmitted: true };
  }
  const submission = await repo.upsertAttendanceDaySubmission(tenant, {
    classId: input.classId,
    date: input.date,
    submittedBy: input.submittedBy,
  });
  await broadcastCollection("attendance");
  return { submission, alreadySubmitted: false };
}

/** Reopens a submitted day so it can be corrected. */
export async function reopenSubmittedAttendanceDay(
  tenant: string,
  input: {
    classId: string;
    date: string;
    reopenedBy: string;
    reason?: string | null;
  },
): Promise<AttendanceDaySubmission> {
  const row = await repo.reopenAttendanceDay(tenant, {
    classId: input.classId,
    date: input.date,
    reopenedBy: input.reopenedBy,
    reason: input.reason ?? null,
  });
  if (!row) {
    throw new NotFoundError("This attendance day was never submitted");
  }
  await broadcastCollection("attendance");
  return row;
}
