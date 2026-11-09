import { type AttendanceLeaveStatus, type User } from "@mms/shared";
import { recordModernAuditEvent, type DbOrTransaction } from "../../services/auditTrailService.js";
import { notificationsUseCases } from "../../notifications/use-cases/notificationsUseCases.js";
import {
  attendanceLeaveRepository as repo,
  type AttendanceLeaveRecord,
} from "../repository/attendanceLeaveAdapter.js";

/**
 * Excuse audit + notification emission, split from the lifecycle use case for the 300-line band.
 *
 * Every helper takes the caller's transaction: a decision and the rows it excuses must commit (or
 * roll back) with their audit trail.
 */

/** Note written onto a mark converted by an approved leave. */
export const EXCUSE_NOTE = "Excused by approved leave";

export async function notifyLeaveDecision(
  tenant: string,
  leave: AttendanceLeaveRecord,
  decision: "approved" | "rejected",
): Promise<void> {
  await notificationsUseCases.notify(tenant, {
    kind: "attendance_leave_decided",
    audiencePermission: "attendance.write",
    entityType: "attendance_leave",
    entityId: leave.id,
    subjectLabel: leave.studentName || leave.studentId,
    contextLabel: `${leave.fromDate ?? "?"} → ${leave.toDate ?? "?"} · ${decision}`,
  });
}

/**
 * Converts the covered unexcused absences to `excused`, in the decision's transaction.
 *
 * Only `absent` rows are touched — a `present`/`late` mark is evidence the student *was* there, and
 * rewriting it would destroy the record the leave is meant to explain.
 */
export async function syncExcusedMarks(
  tx: DbOrTransaction,
  tenant: string,
  leave: AttendanceLeaveRecord,
  actor: User,
): Promise<void> {
  if (!leave.fromDate || !leave.toDate) return;
  const changed = await repo.excuseAbsencesInRange(tenant, {
    studentId: leave.studentId,
    fromDate: leave.fromDate,
    toDate: leave.toDate,
    note: EXCUSE_NOTE,
  });
  for (const row of changed) {
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: tenant.trim().toLowerCase(),
      tableName: "attendance",
      recordId: row.id,
      actionType: "UPDATE",
      realUserId: actor.id ? String(actor.id) : null,
      oldState: {
        status: "absent",
        notes: row.previousNotes,
        studentId: row.studentId,
        classId: row.classId,
        date: row.date,
      },
      newState: {
        status: "excused",
        notes: EXCUSE_NOTE,
        studentId: row.studentId,
        classId: row.classId,
        date: row.date,
        tag: "attendance.leave_sync",
        leaveId: leave.id,
      },
      minimizeDelta: true,
    });
  }
}

export async function auditLeave(
  tx: DbOrTransaction,
  tenant: string,
  actor: User,
  leave: AttendanceLeaveRecord,
  from: AttendanceLeaveStatus,
  to: AttendanceLeaveStatus,
  note: string | null,
): Promise<void> {
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: tenant.trim().toLowerCase(),
    tableName: "attendance_leaves",
    recordId: leave.id,
    actionType: "UPDATE",
    realUserId: actor.id ? String(actor.id) : null,
    oldState: { status: from },
    newState: {
      status: to,
      studentId: leave.studentId,
      fromDate: leave.fromDate,
      toDate: leave.toDate,
      leaveType: leave.leaveType,
      reviewedBy: leave.reviewedBy,
      note,
    },
    minimizeDelta: true,
  });
}
