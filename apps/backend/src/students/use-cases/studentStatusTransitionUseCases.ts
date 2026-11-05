import { studentStatusEndsEnrollments, type User } from "@mms/shared";
import {
  mapActionStringToAuditType,
  recordModernAuditEvent,
} from "../../services/auditTrailService.js";
import { withdrawEnrollmentsForStudentStatus } from "../../enrollments/use-cases/enrollmentEndUseCases.js";
import type { OperationActor } from "../../enrollments/repository/enrollmentOperationsRepository.js";

/** Actor recorded on enrollment withdrawals and status audit rows. */
export type StudentStatusActor = OperationActor;

/** Builds the enrollment/finance actor for a status transition (System when there is no user). */
export function buildStudentStatusActor(user?: User): StudentStatusActor | undefined {
  if (!user?.id) return undefined;
  return { userId: String(user.id), label: user.name || user.email || String(user.id) };
}

/**
 * Withdraws the live enrollments of every student whose status transition ends them.
 *
 * Must run inside the caller's transaction: the enrollment/finance pipeline owns the seat release,
 * waitlist offer and withdrawal invoice settlement, and a failure here has to roll the status change
 * back so the two domains never disagree (`mms-student-lifecycle` §1).
 *
 * @param previousStatusById status captured before the write, keyed by student id.
 * @returns how many students were withdrawn.
 */
export async function withdrawEnrollmentsEndedByStatus(
  tenant: string,
  ids: string[],
  nextStatus: string,
  previousStatusById: Map<string, string | undefined>,
  actor?: StudentStatusActor,
): Promise<number> {
  let withdrawn = 0;
  for (const id of ids) {
    if (!studentStatusEndsEnrollments(previousStatusById.get(id), nextStatus)) continue;
    await withdrawEnrollmentsForStudentStatus(tenant, id, nextStatus, actor);
    withdrawn += 1;
  }
  return withdrawn;
}

export interface StudentStatusTransition {
  id: string;
  previousStatus?: string;
  nextStatus: string;
}

/**
 * Writes one subject-scoped audit row per student whose status actually changed.
 *
 * Bulk status changes previously recorded a single collection row (`recordId`/`subjectId` =
 * `"students"`), which made the chain useless for per-student forensics and left the payload
 * unencrypted under the wrong subject.
 */
export async function recordStudentStatusAuditEvents(
  tenant: string,
  transitions: StudentStatusTransition[],
  userId?: string,
): Promise<void> {
  for (const transition of transitions) {
    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: "students",
      recordId: transition.id,
      actionType: mapActionStringToAuditType("student.status_change"),
      ...(userId ? { realUserId: userId } : {}),
      subjectId: transition.id,
      oldState: { status: transition.previousStatus },
      newState: { status: transition.nextStatus },
      minimizeDelta: true,
    });
  }
}

/** Students whose status actually changes in this write (case-insensitive, blanks normalised). */
export function collectStatusTransitions(
  rows: Array<{ id: string | number; status?: string | null }>,
  nextStatus: string,
): StudentStatusTransition[] {
  const normalizedNext = nextStatus.trim().toLowerCase();
  return rows
    .map((row) => ({
      id: String(row.id),
      previousStatus: row.status ?? undefined,
      nextStatus: normalizedNext,
    }))
    .filter(
      (transition) =>
        (transition.previousStatus ?? "").trim().toLowerCase() !== transition.nextStatus,
    );
}
