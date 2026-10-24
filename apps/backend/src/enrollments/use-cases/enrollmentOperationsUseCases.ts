import {
  enrollmentFeeForClass,
  enrollmentTransferBodySchema,
  enrollmentWithdrawBodySchema,
  normalizeEnrollmentModulePreferences,
  type Enrollment,
  type EnrollmentPlacement,
  type EnrollmentTransferBody,
  type EnrollmentWithdrawBody,
  type User,
  type WithdrawalBillingOutcome,
} from "@mms/shared";
import { enrollmentOperationsRepository as repo } from "../repository/enrollmentOperationsRepositoryAdapter.js";
import { actorOf, afterChange, loadOperable } from "./enrollmentOperationsSupport.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { settleEnrollmentWithdrawal } from "../../finance/use-cases/financeEnrollmentBillingUseCases.js";
import { findTransferTarget, operationWindowError } from "./enrollmentOperationRules.js";
import { offerFreedSeat } from "./admissionsWaitlistUseCases.js";

export const enrollmentOperationsUseCases = {
  async placements(tenant: string, id: string): Promise<EnrollmentPlacement[]> {
    const enrollment = await repo.findEnrollmentById(tenant, id);
    if (!enrollment) throw new NotFoundError("Enrollment not found");
    return repo.listEnrollmentPlacements(tenant, id);
  },

  async transfer(
    tenant: string,
    id: string,
    body: EnrollmentTransferBody,
    user: User,
  ): Promise<Enrollment> {
    const input = enrollmentTransferBodySchema.parse(body);
    const prefs = normalizeEnrollmentModulePreferences(
      await repo.getEnrollmentModulePreferencesByWorkspace(tenant),
    );
    if (!prefs.allowTransfers)
      throw new ConflictError("Transfers are turned off in Enrollments → Setup → Preferences");
    const { enrollment, session, placements, today } = await loadOperable(tenant, id);
    const windowError = operationWindowError(enrollment, placements, input.effectiveOn, today);
    if (windowError) throw new ValidationError(windowError);
    const target = findTransferTarget(session, enrollment, input.classId, input.sectionId ?? null);
    if ("error" in target) throw new ValidationError(target.error);
    if (target.seatsLeft !== null && target.seatsLeft <= 0)
      throw new ConflictError(`${target.cls.name} has no free seats`);

    const [student] = await repo.findStudentsByIds(tenant, [enrollment.studentId]);
    const fee = enrollmentFeeForClass(session.baseFee, target.cls, student ?? {});

    await repo.applyEnrollmentTransfer(tenant, {
      enrollmentId: enrollment.id,
      from: { classId: enrollment.classId, sectionId: enrollment.sectionId ?? null },
      to: { classId: target.cls.id, className: target.cls.name, sectionId: target.sectionId },
      fee,
      effectiveOn: input.effectiveOn,
      reason: input.reason,
      actor: actorOf(user),
    });
    const waitlistOffer =
      target.cls.id !== enrollment.classId
        ? await offerFreedSeat(tenant, enrollment.classId)
        : null;
    return afterChange(tenant, user, enrollment, "transfer", {
      waitlistOfferApplicationId: waitlistOffer?.id ?? null,
      fromClassId: enrollment.classId,
      toClassId: target.cls.id,
      toSectionId: target.sectionId,
      fromFinalFee: enrollment.finalFee,
      toFinalFee: fee.finalFee,
      effectiveOn: input.effectiveOn,
      reason: input.reason,
    });
  },

  async withdraw(
    tenant: string,
    id: string,
    body: EnrollmentWithdrawBody,
    user: User,
  ): Promise<{ enrollment: Enrollment; billing: WithdrawalBillingOutcome }> {
    const input = enrollmentWithdrawBodySchema.parse(body);
    const { enrollment, placements, today } = await loadOperable(tenant, id);
    const windowError = operationWindowError(enrollment, placements, input.effectiveOn, today);
    if (windowError) throw new ValidationError(windowError);
    await repo.applyEnrollmentWithdrawal(tenant, {
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      effectiveOn: input.effectiveOn,
      reason: input.reason,
      actor: actorOf(user),
    });
    // Last month is charged in full; later untouched invoices are cancelled (decision 2026-10-19).
    const billing = await settleEnrollmentWithdrawal(enrollment.id, input.effectiveOn);
    const waitlistOffer = await offerFreedSeat(tenant, enrollment.classId);
    const after = await afterChange(tenant, user, enrollment, "withdraw", {
      effectiveOn: input.effectiveOn,
      reason: input.reason,
      cancelledInvoiceIds: billing.cancelled.map((invoice) => invoice.id),
      invoicesForReview: billing.review.map((invoice) => invoice.id),
      waitlistOfferApplicationId: waitlistOffer?.id ?? null,
    });
    return { enrollment: after, billing };
  },
};
