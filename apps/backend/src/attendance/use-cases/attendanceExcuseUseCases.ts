import {
  canTransitionAttendanceLeave,
  type AttendanceLeaveCancel,
  type AttendanceLeaveInsert,
  type AttendanceLeaveListQuery,
  type AttendanceLeaveReview,
  type AttendanceLeaveStatus,
  type User,
} from "@mms/shared";
import {
  attendanceLeaveRepository as repo,
  type AttendanceLeaveRecord,
} from "../repository/attendanceLeaveAdapter.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import {
  ConflictError,
  HttpDomainError,
  NotFoundError,
  ValidationError,
} from "../../lib/httpErrors.js";
import { withTenant } from "../../db/tenant-context.js";
import { recordModernAuditEvent, type DbOrTransaction } from "../../services/auditTrailService.js";
import { notificationsUseCases } from "../../notifications/use-cases/notificationsUseCases.js";

/**
 * Excuse / medical-leave lifecycle.
 *
 * Submission starts `pending`; a reviewer decides once; an approved leave **retroactively excuses the
 * unexcused absences it covers**, in the same transaction as the decision, and the whole path is
 * serialised against attendance writes by a per-student advisory lock so "is the student on leave?"
 * cannot be answered differently by the two writers.
 */

const EXCUSE_NOTE = "Excused by approved leave";

function requireTenant(): string {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  return tenant;
}

function invalidTransition(
  from: AttendanceLeaveStatus,
  to: AttendanceLeaveStatus,
): HttpDomainError {
  return new HttpDomainError(
    409,
    "attendance_leave_invalid_transition",
    `A ${from} excuse cannot become ${to}`,
  );
}

async function loadLeave(tenant: string, id: string): Promise<AttendanceLeaveRecord> {
  const leave = await repo.findAttendanceLeaveById(tenant, id);
  if (!leave) throw new NotFoundError("Excuse request not found");
  return leave;
}

async function notifyLeaveDecision(
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
async function syncExcusedMarks(
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

async function auditLeave(
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

export function createAttendanceExcuseUseCases() {
  return {
    listExcuses: (query: AttendanceLeaveListQuery): Promise<AttendanceLeaveRecord[]> => {
      const tenant = requireTenant();
      return repo.listAttendanceLeaves(tenant, query);
    },

    /** Files a pending excuse. Overlap with an existing approved leave is rejected up front. */
    submitExcuse: async (
      input: AttendanceLeaveInsert,
      actor: User,
    ): Promise<AttendanceLeaveRecord> => {
      const tenant = requireTenant();
      if (input.toDate < input.fromDate) {
        throw new ValidationError("The leave end date cannot be before its start date");
      }
      return withTenant(
        tenant,
        async () => {
          await repo.lockAttendanceStudents(tenant, [input.studentId]);
          const overlapping = await repo.listAttendanceLeaves(tenant, {
            studentId: input.studentId,
            fromDate: input.fromDate,
            toDate: input.toDate,
          });
          const approved = overlapping.find((row) => row.status === "approved");
          if (approved) {
            throw new ConflictError(
              `The student already has approved leave from ${approved.fromDate} to ${approved.toDate}`,
            );
          }
          const id = await repo.insertPendingLeave(tenant, {
            studentId: input.studentId,
            fromDate: input.fromDate,
            toDate: input.toDate,
            reason: input.reason,
            leaveType: input.leaveType,
            documentRef: input.documentRef || null,
            notes: input.notes || null,
            submittedBy: String(actor.id),
          });
          const created = await loadLeave(tenant, id);
          await broadcastCollection("attendance");
          return created;
        },
        { readOnly: false },
      );
    },

    /**
     * Approves or rejects a pending excuse. Approval converts the covered `absent` marks inside the
     * decision's transaction; rejection changes nothing but the request.
     */
    reviewExcuse: async (
      id: string,
      input: AttendanceLeaveReview,
      actor: User,
    ): Promise<AttendanceLeaveRecord> => {
      const tenant = requireTenant();
      return withTenant(
        tenant,
        async (tx) => {
          const leave = await loadLeave(tenant, id);
          const target: AttendanceLeaveStatus =
            input.decision === "approve" ? "approved" : "rejected";
          if (!canTransitionAttendanceLeave(leave.status, target)) {
            throw invalidTransition(leave.status, target);
          }
          await repo.lockAttendanceStudents(tenant, [leave.studentId]);

          const decided = await repo.decideAttendanceLeave(tenant, {
            id,
            status: target,
            reviewedBy: String(actor.id),
            note: input.note ?? null,
          });
          // Lost the race with another reviewer: the guarded UPDATE matched no pending row.
          if (!decided) throw invalidTransition(leave.status, target);

          if (target === "approved") {
            await syncExcusedMarks(tx, tenant, decided, actor);
          }

          await auditLeave(tx, tenant, actor, decided, leave.status, target, input.note ?? null);
          await notifyLeaveDecision(tenant, decided, target);
          await broadcastCollection("attendance");
          return decided;
        },
        { readOnly: false },
      );
    },

    /**
     * Cancels a pending request or revokes an approved leave. Revocation stops future coverage; it
     * does **not** rewrite the marks it already excused — that decision stands as historical fact.
     */
    cancelExcuse: async (
      id: string,
      input: AttendanceLeaveCancel,
      actor: User,
    ): Promise<AttendanceLeaveRecord> => {
      const tenant = requireTenant();
      return withTenant(
        tenant,
        async (tx) => {
          const leave = await loadLeave(tenant, id);
          if (!canTransitionAttendanceLeave(leave.status, "cancelled")) {
            throw invalidTransition(leave.status, "cancelled");
          }
          const cancelled = await repo.cancelAttendanceLeave(tenant, {
            id,
            cancelledBy: String(actor.id),
            reason: input.reason ?? null,
          });
          if (!cancelled) throw invalidTransition(leave.status, "cancelled");

          await auditLeave(
            tx,
            tenant,
            actor,
            cancelled,
            leave.status,
            "cancelled",
            input.reason ?? null,
          );
          await broadcastCollection("attendance");
          return cancelled;
        },
        { readOnly: false },
      );
    },
  };
}

export const attendanceExcuseUseCases = createAttendanceExcuseUseCases();
