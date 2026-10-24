import type { WithdrawalBillingOutcome } from "@mms/shared";
import { enrollmentOperationsRepository as repo } from "../repository/enrollmentOperationsRepositoryAdapter.js";
import type { OperationActor } from "../repository/enrollmentOperationsRepository.js";
import { settleEnrollmentWithdrawal } from "../../finance/use-cases/financeEnrollmentBillingUseCases.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { offerFreedSeat } from "./admissionsWaitlistUseCases.js";
import { todayInTimeZone } from "../../lib/dbDate.js";

/** Actor for changes triggered by the system (e.g. a student status change without a user). */
export const SYSTEM_ACTOR: OperationActor = { userId: null, label: "System" };

/**
 * Ends every live enrollment of the given sessions or student on `lastDay` through the withdrawal
 * path: window end, placement closed, seat released, later untouched invoices cancelled (paid ones
 * returned for review). Freed seats go to the waitlist only for withdrawals, not cancellations.
 */
export async function endLiveEnrollments(
  tenant: string,
  filter: { sessionIds?: readonly string[]; studentId?: string },
  options: {
    status: "withdrawn" | "cancelled";
    lastDay: string;
    reason: string;
    actor: OperationActor;
  },
): Promise<{ ended: number; billing: WithdrawalBillingOutcome }> {
  const live = await repo.listLiveEnrollments(tenant, filter);
  const billing: WithdrawalBillingOutcome = { cancelled: [], review: [] };
  for (const enrollment of live) {
    await repo.applyEnrollmentWithdrawal(tenant, {
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      effectiveOn: options.lastDay,
      reason: options.reason,
      actor: options.actor,
      status: options.status,
    });
    const settled = await settleEnrollmentWithdrawal(enrollment.id, options.lastDay);
    billing.cancelled.push(...settled.cancelled);
    billing.review.push(...settled.review);
    if (options.status === "withdrawn") await offerFreedSeat(tenant, enrollment.classId);
  }
  if (live.length > 0) {
    await invalidateMultiTierCache({ tenantId: tenant, domain: "students" });
    await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
    await broadcastCollection("enrollments");
    await broadcastCollection("sessions");
  }
  return { ended: live.length, billing };
}

/** A student left (inactive / transferred / graduated): withdraw their live enrollments today. */
export async function withdrawEnrollmentsForStudentStatus(
  tenant: string,
  studentId: string,
  status: string,
  actor: OperationActor = SYSTEM_ACTOR,
): Promise<{ ended: number; billing: WithdrawalBillingOutcome }> {
  const lastDay = todayInTimeZone(await repo.findWorkspaceTimezone(tenant));
  return endLiveEnrollments(
    tenant,
    { studentId },
    { status: "withdrawn", lastDay, reason: `Student marked ${status}`, actor },
  );
}
