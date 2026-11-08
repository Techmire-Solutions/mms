import { and, eq, inArray, isNull } from "drizzle-orm";
import { enrollmentPlacements, enrollments } from "../schema.js";
import { withTenant, withTenantRead, type TenantTransaction } from "../tenant-context.js";
import {
  closePlacementTx,
  insertTypedTimelineEventTx,
  movePlacementTx,
} from "./enrollmentHistoryWrite.js";
import { syncEnrolledSessionsTx } from "./enrollmentSessionSync.js";
import { enrollmentHoldsSeatWhere } from "./enrollmentSeatSql.js";
import { assertSeatCapacityTx, lockSectionsForSeatsTx } from "./enrollmentSeatCountRepository.js";
import { NotFoundError } from "../../lib/httpErrors.js";

export { listEnrollmentPlacements } from "./enrollmentPlacementHistory.js";

/** Live seat counts and rollover carry locks (split out to keep this module under 300 lines). */
export { countLiveSeatsByClassTx, lockRolloverCarryTx } from "./enrollmentSeatCountRepository.js";
export type { LiveSeatCount } from "./enrollmentSeatCountRepository.js";

export interface EnrollmentFeeColumns {
  baseFee: number;
  discountType: string;
  discountLabel: string;
  discountPct: number;
  discountAmt: number;
  finalFee: number;
}

const feeColumns = (fee: EnrollmentFeeColumns) => ({
  baseFee: String(fee.baseFee),
  discountType: fee.discountType,
  discountLabel: fee.discountLabel,
  discountPct: String(fee.discountPct),
  discountAmt: String(fee.discountAmt),
  finalFee: String(fee.finalFee),
});

export type EndedEnrollmentStatus =
  "withdrawn" | "cancelled" | "completed" | "promoted" | "retained" | "graduated" | "left";

const ENDED_EVENT_LABEL: Record<EndedEnrollmentStatus, string> = {
  withdrawn: "Withdrawn",
  cancelled: "Cancelled with the session",
  completed: "Completed with the session",
  promoted: "Promoted to the next session",
  retained: "Retained for the next session",
  graduated: "Graduated",
  left: "Left at year end",
};

export interface OperationActor {
  userId: string | null;
  label: string;
}

/** Row-locks the target section and refuses the write when it has no free seat. */
async function lockAndAssertSeatTx(
  tx: TenantTransaction,
  subdomain: string,
  sectionId: string,
  enrollmentId: string,
): Promise<void> {
  const sections = await lockSectionsForSeatsTx(tx, subdomain, [sectionId]);
  const section = sections.get(sectionId);
  if (!section) throw new NotFoundError("Section not found");
  await assertSeatCapacityTx(tx, subdomain, { section, excludeEnrollmentIds: [enrollmentId] });
}

const enrollmentKey = (subdomain: string, id: string) =>
  and(
    eq(enrollments.workspaceSubdomain, subdomain),
    eq(enrollments.id, id),
    isNull(enrollments.deletedAt),
  );

/** Moves the enrollment to a class/section from a date: placement history + current columns + event. */
export async function applyEnrollmentTransfer(
  tenant: string,
  input: {
    enrollmentId: string;
    from: { classId: string; sectionId: string | null };
    to: { classId: string; className: string; sectionId: string | null };
    /** Fee recomputed for the target class; applies to invoices generated from now on. */
    fee: EnrollmentFeeColumns;
    effectiveOn: string;
    reason: string;
    actor: OperationActor;
  },
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    // The use case's seat pre-check happens before this transaction; a concurrent writer
    // can take the last seat in between, so the seat is re-asserted under the section lock.
    if (input.to.sectionId && input.to.sectionId !== input.from.sectionId) {
      await lockAndAssertSeatTx(tx, subdomain, input.to.sectionId, input.enrollmentId);
    }
    await tx
      .update(enrollments)
      .set({
        classId: input.to.classId,
        className: input.to.className,
        sectionId: input.to.sectionId,
        // Roll numbers are unique per section; the new section assigns its own.
        rollNo: null,
        ...feeColumns(input.fee),
        updatedAt: new Date(),
      })
      .where(enrollmentKey(subdomain, input.enrollmentId));
    await movePlacementTx(tx, subdomain, {
      enrollmentId: input.enrollmentId,
      classId: input.to.classId,
      sectionId: input.to.sectionId,
      effectiveOn: input.effectiveOn,
      reason: input.reason,
      actorUserId: input.actor.userId,
    });
    await insertTypedTimelineEventTx(tx, subdomain, {
      enrollmentId: input.enrollmentId,
      eventType: "transferred",
      event: `Transferred to ${input.to.className}`,
      actorUserId: input.actor.userId,
      actorLabel: input.actor.label,
      effectiveOn: input.effectiveOn,
      reason: input.reason,
      fromClassId: input.from.classId,
      toClassId: input.to.classId,
      fromSectionId: input.from.sectionId,
      toSectionId: input.to.sectionId,
    });
  });
}

/** Ends the enrollment on a date: status `withdrawn`, window end, placement closed, seat released. */
export async function applyEnrollmentWithdrawal(
  tenant: string,
  input: {
    enrollmentId: string;
    studentId: string;
    effectiveOn: string;
    reason: string;
    actor: OperationActor;
    /** `cancelled` (session cancelled) or a rollover outcome; default `withdrawn`. */
    status?: EndedEnrollmentStatus;
  },
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const status = input.status ?? "withdrawn";
  await withTenant(subdomain, async (tx) => {
    const [open] = await tx
      .select({ id: enrollmentPlacements.id, startOn: enrollmentPlacements.startOn })
      .from(enrollmentPlacements)
      .where(
        and(
          eq(enrollmentPlacements.workspaceSubdomain, subdomain),
          eq(enrollmentPlacements.enrollmentId, input.enrollmentId),
          isNull(enrollmentPlacements.endOn),
        ),
      )
      .for("update");
    // A placement that has not started yet (session cancelled before start) ends on its first day.
    const endOn = open && open.startOn > input.effectiveOn ? open.startOn : input.effectiveOn;
    await tx
      .update(enrollments)
      .set({ status, endOn, endReason: input.reason, updatedAt: new Date() })
      .where(enrollmentKey(subdomain, input.enrollmentId));
    if (open) await closePlacementTx(tx, subdomain, open.id, endOn);
    await insertTypedTimelineEventTx(tx, subdomain, {
      enrollmentId: input.enrollmentId,
      eventType: status,
      event: ENDED_EVENT_LABEL[status],
      actorUserId: input.actor.userId,
      actorLabel: input.actor.label,
      effectiveOn: endOn,
      reason: input.reason,
    });
    await syncEnrolledSessionsTx(tx, subdomain, { studentIds: [input.studentId] });
  });
}

export interface LiveEnrollmentRow {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  sectionId: string | null;
}

/** Live (seat-holding) enrollments of the given sessions or student. */
export async function listLiveEnrollments(
  tenant: string,
  filter: { sessionIds?: readonly string[]; studentId?: string },
): Promise<LiveEnrollmentRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  const conditions = [
    eq(enrollments.workspaceSubdomain, subdomain),
    isNull(enrollments.deletedAt),
    enrollmentHoldsSeatWhere(),
  ];
  if (filter.sessionIds) conditions.push(inArray(enrollments.sessionId, [...filter.sessionIds]));
  if (filter.studentId) conditions.push(eq(enrollments.studentId, filter.studentId));
  if (!filter.sessionIds && !filter.studentId) return [];
  if (filter.sessionIds && filter.sessionIds.length === 0) return [];
  return withTenantRead(subdomain, (tx) =>
    tx
      .select({
        id: enrollments.id,
        studentId: enrollments.studentId,
        studentName: enrollments.studentName,
        classId: enrollments.classId,
        sectionId: enrollments.sectionId,
      })
      .from(enrollments)
      .where(and(...conditions)),
  );
}

/** Brings a withdrawn enrollment back: confirmed again, window end cleared, new open placement. */
export async function applyEnrollmentReadmission(
  tenant: string,
  input: {
    enrollmentId: string;
    studentId: string;
    to: { classId: string; className: string; sectionId: string | null };
    fee: EnrollmentFeeColumns;
    effectiveOn: string;
    reason: string;
    actor: OperationActor;
  },
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    // A withdrawn row holds no seat; readmission takes one again, under the section lock.
    if (input.to.sectionId) {
      await lockAndAssertSeatTx(tx, subdomain, input.to.sectionId, input.enrollmentId);
    }
    await tx
      .update(enrollments)
      .set({
        status: "confirmed",
        endOn: null,
        endReason: null,
        classId: input.to.classId,
        className: input.to.className,
        sectionId: input.to.sectionId,
        rollNo: null,
        ...feeColumns(input.fee),
        updatedAt: new Date(),
      })
      .where(enrollmentKey(subdomain, input.enrollmentId));
    await movePlacementTx(tx, subdomain, {
      enrollmentId: input.enrollmentId,
      classId: input.to.classId,
      sectionId: input.to.sectionId,
      effectiveOn: input.effectiveOn,
      reason: input.reason,
      actorUserId: input.actor.userId,
    });
    await insertTypedTimelineEventTx(tx, subdomain, {
      enrollmentId: input.enrollmentId,
      eventType: "readmitted",
      event: `Re-admitted to ${input.to.className}`,
      actorUserId: input.actor.userId,
      actorLabel: input.actor.label,
      effectiveOn: input.effectiveOn,
      reason: input.reason,
      toClassId: input.to.classId,
      toSectionId: input.to.sectionId,
    });
    await syncEnrolledSessionsTx(tx, subdomain, { studentIds: [input.studentId] });
  });
}

/** Timeline entry for a suspension (the leave range itself is owned by Attendance). */
export { recordEnrollmentSuspension } from "./enrollmentHistoryWrite.js";
