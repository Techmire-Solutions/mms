import type { AuditActionType, AttendanceRecord, User } from "@mms/shared";
import { recordModernAuditEvent, type DbOrTransaction } from "../../services/auditTrailService.js";

/**
 * Attendance audit emission.
 *
 * Attendance is evidence: report cards, completion gates and certificate freezes (0207) all read it,
 * so every mutation must leave a hash-chained record of who changed what. The row itself only keeps
 * `marked_by` (the last writer); the audit row keeps the *transition*.
 *
 * Callers must pass the transaction they are already inside — an audit row that commits separately
 * from the write it describes is worse than none.
 */

export interface AttendanceAuditInput {
  tenant: string;
  actor: User;
  action: AuditActionType;
  record: AttendanceRecord;
  before?: AttendanceRecord | null;
  reason?: string | null;
  /** Semantic sub-label stored in `newState.tag` (e.g. `attendance.override`). */
  tag?: string;
}

function snapshot(record: AttendanceRecord): Record<string, unknown> {
  return {
    classId: record.classId,
    studentId: record.studentId,
    date: record.date,
    status: record.status,
    timeIn: record.timeIn ?? "",
    timeOut: record.timeOut ?? "",
    notes: record.notes ?? "",
    sectionId: record.sectionId ?? null,
    markedBy: record.markedBy ?? null,
    version: record.version ?? null,
  };
}

export async function auditAttendanceMutation(
  tx: DbOrTransaction,
  input: AttendanceAuditInput,
): Promise<void> {
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: input.tenant.trim().toLowerCase(),
    tableName: "attendance",
    recordId: String(input.record.id),
    actionType: input.action,
    realUserId: input.actor.id ? String(input.actor.id) : null,
    oldState: input.before ? snapshot(input.before) : null,
    newState: {
      ...snapshot(input.record),
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.tag ? { tag: input.tag } : {}),
    },
    minimizeDelta: true,
  });
}
