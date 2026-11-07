import {
  enrollmentFeeForClass,
  remainingSeats,
  type Enrollment,
  type Session,
  type Student,
} from "@mms/shared";
import { enrollmentOperationsRepository as ops } from "../repository/enrollmentOperationsRepositoryAdapter.js";
import { admissionsRepository as admissions } from "../repository/admissionsRepositoryAdapter.js";
import type {
  EndedEnrollmentStatus,
  LiveEnrollmentRow,
  OperationActor,
} from "../repository/enrollmentOperationsRepository.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { HttpDomainError } from "../../lib/httpErrors.js";
import { withTenant } from "../../db/tenant-context.js";

export interface RolloverCandidate extends LiveEnrollmentRow {
  student: Student | null;
}

export interface RolloverPlacement {
  candidate: RolloverCandidate;
  targetClassId: string;
  targetSectionId: string | null;
}

/** A rollover whose target cannot seat every carried student (nothing is carried). */
export class RolloverSeatError extends HttpDomainError {
  constructor(readonly violations: readonly string[]) {
    super(
      409,
      "rollover_blocked",
      `Not enough seats in the target session: ${violations.join("; ")}`,
    );
  }
}

export interface RolloverCarryResult {
  created: number;
  /** Source enrollments that now have a target row (only these may be closed). */
  carriedSourceIds: Set<string>;
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
  return live.map((row) => ({ ...row, student: byId.get(String(row.studentId)) ?? null }));
}

/**
 * Pending enrollments in the target session, each linked to the source enrollment it continues;
 * fees are recomputed from the target class. Seat capacity is validated under a per-target advisory
 * lock and the whole batch is rejected when any student does not fit (review finding R4).
 * `idFor` yields a deterministic enrollment id so a retried run upserts instead of duplicating.
 */
export async function carryRolloverEnrollments(
  tenant: string,
  target: Session,
  placements: readonly RolloverPlacement[],
  options: { idFor: (sourceEnrollmentId: string) => string },
): Promise<RolloverCarryResult> {
  if (placements.length === 0) return { created: 0, carriedSourceIds: new Set() };
  const classes = new Map(target.classes.map((cls) => [cls.id, cls]));
  return withTenant(tenant, async () => {
    await ops.lockRolloverCarryTx(tenant, target.id);
    const used = new Map<string, number>();
    for (const row of await ops.countLiveSeatsByClassTx(tenant, target.id)) {
      used.set(`${row.classId}|${row.sectionId ?? ""}`, row.count);
    }

    const problems: string[] = [];
    const records: Enrollment[] = [];
    for (const { candidate, targetClassId, targetSectionId } of placements) {
      const cls = classes.get(targetClassId);
      if (!cls) {
        problems.push(`${candidate.studentName}: target class is missing`);
        continue;
      }
      const sections = (cls.sections ?? []).filter(
        (section) => (section.status ?? "active") === "active",
      );
      let section = targetSectionId
        ? sections.find((candidateSection) => candidateSection.id === targetSectionId)
        : undefined;
      if (!section && sections.length > 0) {
        // Deterministic fallback that respects capacity instead of "first section wins".
        section = sections.find((candidateSection) => {
          const key = `${cls.id}|${candidateSection.id}`;
          return (used.get(key) ?? 0) < Math.max(0, candidateSection.capacity ?? 0);
        });
      }
      const seatKey = `${cls.id}|${section?.id ?? ""}`;
      const capacity = section ? Math.max(0, section.capacity ?? 0) : remainingSeats(cls);
      if (sections.length > 0 && !section) {
        problems.push(`${candidate.studentName}: no free seat in ${cls.name}`);
        continue;
      }
      if (capacity !== null) {
        const occupied = (used.get(seatKey) ?? 0) + 1;
        if (occupied > capacity) {
          problems.push(
            `${candidate.studentName}: ${cls.name}${section ? ` · ${section.name}` : ""} is full`,
          );
          continue;
        }
        used.set(seatKey, occupied);
      }
      records.push({
        id: options.idFor(candidate.id),
        studentId: candidate.studentId,
        studentName: candidate.studentName,
        sessionId: target.id,
        sessionName: target.name,
        classId: cls.id,
        className: cls.name,
        ...(section ? { sectionId: section.id } : {}),
        enrolledDate: target.startDate,
        startOn: target.startDate,
        promotedFromEnrollmentId: candidate.id,
        ...enrollmentFeeForClass(target.baseFee, cls, candidate.student ?? {}),
        status: "pending",
        invoiceId: null,
        paymentStatus: "none",
        notes: "",
        timeline: [],
      });
    }
    if (problems.length > 0) throw new RolloverSeatError(problems);
    await admissions.bulkSaveEnrollments(tenant, records);
    await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
    await broadcastCollection("enrollments");
    await broadcastCollection("sessions");
    return {
      created: records.length,
      carriedSourceIds: new Set(placements.map(({ candidate }) => candidate.id)),
    };
  });
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
