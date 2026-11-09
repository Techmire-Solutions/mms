import { attendanceCalendarRepository as repo } from "../repository/attendanceCalendarRepositoryAdapter.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { withTenant } from "../../db/tenant-context.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { assertTeacherClassScope } from "../../sessions/use-cases/teacherSectionScope.js";
import type { User } from "@mms/shared";
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
  const subdomain = tenant.trim().toLowerCase();
  const id = await withTenant(
    subdomain,
    async (tx) => {
      const result = await repo.insertApprovedLeaveIfFree(tenant, leave);
      if (!result.ok) {
        throw new ConflictError(
          `The student already has approved leave from ${result.conflict.fromDate} to ${result.conflict.toDate}`,
        );
      }
      // Approved leave removes days from every attendance rate, so it is attendance evidence: the
      // attendance module records it, not only the enrollment suspension that triggered it.
      await recordModernAuditEvent(tx, {
        workspaceSubdomain: subdomain,
        tableName: "attendance_leaves",
        recordId: result.id,
        actionType: "CREATE",
        realUserId: leave.approvedBy,
        newState: {
          status: "approved",
          studentId: leave.studentId,
          fromDate: leave.fromOn,
          toDate: leave.toOn,
          reason: leave.reason,
          source: "enrollment_suspension",
          tag: "attendance.leave.suspension",
        },
        minimizeDelta: true,
      });
      return result.id;
    },
    { readOnly: false },
  );
  await broadcastCollection("attendance");
  return id;
}

/**
 * Marks a class/day roster as submitted. Idempotent: submitting an already-submitted day returns the
 * existing state with `alreadySubmitted: true` instead of moving the timestamp (so two taps cannot
 * silently extend the lock).
 */
export async function submitAttendanceDay(
  tenant: string,
  input: { classId: string; date: string; submittedBy: string },
  actor?: User,
): Promise<{ submission: AttendanceDaySubmission; alreadySubmitted: boolean }> {
  const subdomain = tenant.trim().toLowerCase();
  // Locking a class day is a write on that class: a teacher may only submit a day they teach.
  if (actor) {
    await assertTeacherClassScope(actor, tenant, [{ classId: input.classId, date: input.date }]);
  }
  const outcome = await withTenant(
    subdomain,
    async (tx) => {
      const existing = await repo.getAttendanceDaySubmission(tenant, input.classId, input.date);
      if (existing?.locked) return { submission: existing, alreadySubmitted: true };
      const submission = await repo.upsertAttendanceDaySubmission(tenant, {
        classId: input.classId,
        date: input.date,
        submittedBy: input.submittedBy,
      });
      await recordModernAuditEvent(tx, {
        workspaceSubdomain: subdomain,
        tableName: "attendance_day_submissions",
        recordId: `${input.classId}:${input.date.slice(0, 10)}`,
        actionType: "CREATE",
        realUserId: input.submittedBy,
        oldState: { locked: false },
        newState: {
          status: "submitted",
          locked: true,
          classId: input.classId,
          date: input.date.slice(0, 10),
          submittedBy: input.submittedBy,
          tag: "attendance.day.submitted",
        },
        minimizeDelta: true,
      });
      return { submission, alreadySubmitted: false };
    },
    { readOnly: false },
  );
  await broadcastCollection("attendance");
  return outcome;
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
  const subdomain = tenant.trim().toLowerCase();
  const row = await withTenant(
    subdomain,
    async (tx) => {
      const reopened = await repo.reopenAttendanceDay(tenant, {
        classId: input.classId,
        date: input.date,
        reopenedBy: input.reopenedBy,
        reason: input.reason ?? null,
      });
      if (!reopened) return null;
      // Reopening unlocks submitted evidence — the most security-relevant day transition there is.
      await recordModernAuditEvent(tx, {
        workspaceSubdomain: subdomain,
        tableName: "attendance_day_submissions",
        recordId: `${input.classId}:${input.date.slice(0, 10)}`,
        actionType: "UPDATE",
        realUserId: input.reopenedBy,
        oldState: { locked: true },
        newState: {
          status: "reopened",
          locked: false,
          classId: input.classId,
          date: input.date.slice(0, 10),
          reopenedBy: input.reopenedBy,
          ...(input.reason ? { reason: input.reason } : {}),
          tag: "attendance.day.reopened",
        },
        minimizeDelta: true,
      });
      return reopened;
    },
    { readOnly: false },
  );
  if (!row) throw new NotFoundError("This attendance day was never submitted");
  await broadcastCollection("attendance");
  return row;
}
