import { randomUUID } from "node:crypto";
import { enrollmentFeeForClass, type Enrollment, type Session, type Student } from "@mms/shared";
import { enrollmentOperationsRepository as ops } from "../repository/enrollmentOperationsRepositoryAdapter.js";
import { admissionsRepository as admissions } from "../repository/admissionsRepositoryAdapter.js";
import type {
  EndedEnrollmentStatus,
  LiveEnrollmentRow,
  OperationActor,
} from "../repository/enrollmentOperationsRepository.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";

export interface RolloverCandidate extends LiveEnrollmentRow {
  student: Student | null;
}

export interface RolloverPlacement {
  candidate: RolloverCandidate;
  targetClassId: string;
  targetSectionId: string | null;
}

/** Live enrollments of a session with their student records (eligibility, discounts). */
export async function listRolloverCandidates(
  tenant: string,
  sessionId: string,
): Promise<RolloverCandidate[]> {
  const live = await ops.listLiveEnrollments(tenant, { sessionIds: [sessionId] });
  const students = await admissions.findStudentsByIds(tenant, [
    ...new Set(live.map((row) => row.studentId)),
  ]);
  const byId = new Map(students.map((student) => [String(student.id), student]));
  return live.map((row) => ({ ...row, student: byId.get(row.studentId) ?? null }));
}

/**
 * Pending enrollments in the target session, each linked to the source enrollment it continues;
 * fees are recomputed from the target class. Placements and session membership follow the save.
 */
export async function carryRolloverEnrollments(
  tenant: string,
  target: Session,
  placements: readonly RolloverPlacement[],
): Promise<number> {
  const classes = new Map(target.classes.map((cls) => [cls.id, cls]));
  const records = placements.flatMap(({ candidate, targetClassId, targetSectionId }) => {
    const cls = classes.get(targetClassId);
    if (!cls) return [];
    const record: Enrollment = {
      id: `enr-${randomUUID()}`,
      studentId: candidate.studentId,
      studentName: candidate.studentName,
      sessionId: target.id,
      sessionName: target.name,
      classId: cls.id,
      className: cls.name,
      ...(targetSectionId ? { sectionId: targetSectionId } : {}),
      enrolledDate: target.startDate,
      startOn: target.startDate,
      promotedFromEnrollmentId: candidate.id,
      ...enrollmentFeeForClass(target.baseFee, cls, candidate.student ?? {}),
      status: "pending",
      invoiceId: null,
      paymentStatus: "none",
      notes: "",
      timeline: [],
    };
    return [record];
  });
  if (records.length === 0) return 0;
  await admissions.bulkSaveEnrollments(tenant, records);
  await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
  await broadcastCollection("enrollments");
  await broadcastCollection("sessions");
  return records.length;
}

/** Closes a source enrollment with its rollover outcome on the session's last day (no billing). */
export async function closeRolloverSourceEnrollment(
  tenant: string,
  input: {
    enrollmentId: string;
    studentId: string;
    status: Extract<EndedEnrollmentStatus, "promoted" | "retained" | "graduated" | "left">;
    lastDay: string;
    actor: OperationActor;
  },
): Promise<void> {
  await ops.applyEnrollmentWithdrawal(tenant, {
    enrollmentId: input.enrollmentId,
    studentId: input.studentId,
    effectiveOn: input.lastDay,
    reason: "Year-end rollover",
    actor: input.actor,
    status: input.status,
  });
}
