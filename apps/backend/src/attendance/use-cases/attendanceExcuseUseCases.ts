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
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { sessionsAcademicRepository } from "../../sessions/repository/sessionsAcademicRepositoryAdapter.js";
import { auditLeave, notifyLeaveDecision, syncExcusedMarks } from "./attendanceExcuseAudit.js";

/**
 * Excuse / medical-leave lifecycle.
 *
 * Submission starts `pending`; a reviewer decides once; an approved leave **retroactively excuses the
 * unexcused absences it covers**, in the same transaction as the decision, and the whole path is
 * serialised against attendance writes by a per-student advisory lock so "is the student on leave?"
 * cannot be answered differently by the two writers.
 */

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

export function createAttendanceExcuseUseCases() {
  return {
    /**
     * Review queue.
     *
     * A section-scoped teacher sees only excuses for students they teach across the requested range:
     * a leave carries the reason and the medical-certificate reference, so the tenant-wide list was
     * leaking another section's sensitive data to every attendance reader.
     */
    listExcuses: async (
      query: AttendanceLeaveListQuery,
      actor?: User,
    ): Promise<AttendanceLeaveRecord[]> => {
      const tenant = requireTenant();
      const rows = await repo.listAttendanceLeaves(tenant, query);
      if (!actor) return rows;
      const fromDate =
        query.fromDate ??
        rows.reduce(
          (min, row) => (row.fromDate && row.fromDate < min ? row.fromDate : min),
          rows[0]?.fromDate ?? "",
        );
      const toDate =
        query.toDate ??
        rows.reduce(
          (max, row) => (row.toDate && row.toDate > max ? row.toDate : max),
          rows[0]?.toDate ?? "",
        );
      if (!fromDate || !toDate) return rows;
      const taught = await sessionsAcademicRepository.listTaughtStudentIds(
        tenant,
        String(actor.id),
        fromDate,
        toDate,
      );
      if (!taught) return rows;
      return rows.filter((row) => taught.has(row.studentId));
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
      // The schema guarantees the URL *shape*; this guarantees the file is this tenant's. Otherwise a
      // workspace could attach another workspace's path and probe whether it exists.
      if (
        input.documentRef &&
        !input.documentRef.startsWith(`/uploads/tenants/${tenant}/attachments/`)
      ) {
        throw new ValidationError("The attachment does not belong to this workspace");
      }
      return withTenant(
        tenant,
        async (tx) => {
          // A teacher may only file an excuse for a student they actually teach; office staff with
          // no faculty record (null) stay unscoped.
          const taught = await sessionsAcademicRepository.listTaughtStudentIds(
            tenant,
            String(actor.id),
            input.fromDate,
            input.toDate,
          );
          if (taught && !taught.has(input.studentId)) {
            throw new HttpDomainError(
              403,
              "attendance_excuse_out_of_scope",
              "You can only file an excuse for a student you teach in that period",
            );
          }
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
          // The originating excuse event used to leave no trace at all: only the decision did.
          await recordModernAuditEvent(tx, {
            workspaceSubdomain: tenant.trim().toLowerCase(),
            tableName: "attendance_leaves",
            recordId: created.id,
            actionType: "CREATE",
            realUserId: actor.id ? String(actor.id) : null,
            newState: {
              status: "pending",
              studentId: created.studentId,
              fromDate: created.fromDate,
              toDate: created.toDate,
              leaveType: created.leaveType,
              reason: created.reason,
              documentRef: created.documentRef,
              submittedBy: created.submittedBy,
              tag: "attendance.excuse.submitted",
            },
            minimizeDelta: true,
          });
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
