import { and, eq, inArray, isNull } from "drizzle-orm";
import { enrollmentPlacements, enrollments } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { closePlacementTx, insertTypedTimelineEventTx } from "./enrollmentHistoryWrite.js";
import { syncEnrolledSessionsTx } from "./enrollmentSessionSync.js";
import {
  ENDED_EVENT_LABEL,
  NOT_OPERABLE,
  assertChanged,
  operableEnrollmentKey,
  type EndedEnrollmentStatus,
  type OperationActor,
} from "./enrollmentTransitionGuards.js";

/**
 * Batches the rollover source-close (a year-end withdrawal for each carried source enrollment)
 * into a single transaction: one placement lock pass, per-enrollment CAS/close/timeline (the same
 * guards as the single path), and one enrolled-sessions sync for the whole batch.
 */
export async function bulkApplyEnrollmentWithdrawal(
  tenant: string,
  inputs: ReadonlyArray<{
    enrollmentId: string;
    studentId: string;
    status: EndedEnrollmentStatus;
    effectiveOn: string;
  }>,
  reason: string,
  actor: OperationActor,
): Promise<void> {
  if (inputs.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    const ids = inputs.map((input) => input.enrollmentId);
    const openPlacements = await tx
      .select({
        enrollmentId: enrollmentPlacements.enrollmentId,
        id: enrollmentPlacements.id,
        startOn: enrollmentPlacements.startOn,
      })
      .from(enrollmentPlacements)
      .where(
        and(
          eq(enrollmentPlacements.workspaceSubdomain, subdomain),
          inArray(enrollmentPlacements.enrollmentId, ids),
          isNull(enrollmentPlacements.endOn),
        ),
      )
      .for("update");
    const openByEnrollment = new Map(openPlacements.map((row) => [row.enrollmentId, row]));

    for (const input of inputs) {
      const open = openByEnrollment.get(input.enrollmentId);
      // A placement that has not started yet ends on its first day (matches the single path).
      const endOn = open && open.startOn > input.effectiveOn ? open.startOn : input.effectiveOn;
      const changed = await tx
        .update(enrollments)
        .set({ status: input.status, endOn, endReason: reason, updatedAt: new Date() })
        .where(operableEnrollmentKey(subdomain, input.enrollmentId))
        .returning({ id: enrollments.id });
      assertChanged(changed.length, NOT_OPERABLE);
      if (open) await closePlacementTx(tx, subdomain, open.id, endOn);
      await insertTypedTimelineEventTx(tx, subdomain, {
        enrollmentId: input.enrollmentId,
        eventType: input.status,
        event: ENDED_EVENT_LABEL[input.status],
        actorUserId: actor.userId,
        actorLabel: actor.label,
        effectiveOn: endOn,
        reason,
      });
    }

    await syncEnrolledSessionsTx(tx, subdomain, {
      studentIds: [...new Set(inputs.map((input) => input.studentId))],
    });
  });
}
