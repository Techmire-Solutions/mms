import { and, asc, eq, isNull } from "drizzle-orm";
import type { EnrollmentPlacement } from "@mms/shared";
import { enrollmentPlacements, enrollments } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import {
  closePlacementTx,
  insertTypedTimelineEventTx,
  movePlacementTx,
} from "./enrollmentHistoryWrite.js";
import { syncEnrolledSessionsTx } from "./enrollmentSessionSync.js";

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

export interface OperationActor {
  userId: string | null;
  label: string;
}

export async function listEnrollmentPlacements(
  tenant: string,
  enrollmentId: string,
): Promise<EnrollmentPlacement[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, (tx) =>
    tx
      .select({
        id: enrollmentPlacements.id,
        enrollmentId: enrollmentPlacements.enrollmentId,
        classId: enrollmentPlacements.classId,
        sectionId: enrollmentPlacements.sectionId,
        startOn: enrollmentPlacements.startOn,
        endOn: enrollmentPlacements.endOn,
        reason: enrollmentPlacements.reason,
      })
      .from(enrollmentPlacements)
      .where(
        and(
          eq(enrollmentPlacements.workspaceSubdomain, subdomain),
          eq(enrollmentPlacements.enrollmentId, enrollmentId),
        ),
      )
      .orderBy(asc(enrollmentPlacements.startOn)),
  );
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
  },
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .update(enrollments)
      .set({
        status: "withdrawn",
        endOn: input.effectiveOn,
        endReason: input.reason,
        updatedAt: new Date(),
      })
      .where(enrollmentKey(subdomain, input.enrollmentId));
    const [open] = await tx
      .select({ id: enrollmentPlacements.id })
      .from(enrollmentPlacements)
      .where(
        and(
          eq(enrollmentPlacements.workspaceSubdomain, subdomain),
          eq(enrollmentPlacements.enrollmentId, input.enrollmentId),
          isNull(enrollmentPlacements.endOn),
        ),
      )
      .for("update");
    if (open) await closePlacementTx(tx, subdomain, open.id, input.effectiveOn);
    await insertTypedTimelineEventTx(tx, subdomain, {
      enrollmentId: input.enrollmentId,
      eventType: "withdrawn",
      event: "Withdrawn",
      actorUserId: input.actor.userId,
      actorLabel: input.actor.label,
      effectiveOn: input.effectiveOn,
      reason: input.reason,
    });
    await syncEnrolledSessionsTx(tx, subdomain, { studentIds: [input.studentId] });
  });
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
export async function recordEnrollmentSuspension(
  tenant: string,
  input: {
    enrollmentId: string;
    fromOn: string;
    toOn: string;
    reason: string;
    actor: OperationActor;
  },
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, (tx) =>
    insertTypedTimelineEventTx(tx, subdomain, {
      enrollmentId: input.enrollmentId,
      eventType: "suspended",
      event: `Suspended ${input.fromOn} – ${input.toOn}`,
      actorUserId: input.actor.userId,
      actorLabel: input.actor.label,
      effectiveOn: input.fromOn,
      reason: input.reason,
    }),
  );
}
