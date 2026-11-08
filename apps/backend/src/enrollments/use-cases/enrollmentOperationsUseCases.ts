import {
  enrollmentBulkEndBodySchema,
  enrollmentFeeForClass,
  enrollmentTransferBodySchema,
  enrollmentWithdrawBodySchema,
  dropDeadlineError,
  normalizeEnrollmentModulePreferences,
  type Enrollment,
  type EnrollmentPlacement,
  type EnrollmentTransferBody,
  type EnrollmentWithdrawBody,
  type User,
  type WithdrawalBillingOutcome,
} from "@mms/shared";
import { enrollmentOperationsRepository as repo } from "../repository/enrollmentOperationsRepositoryAdapter.js";
import {
  actorOf,
  afterChange,
  loadOperable,
  recordOperationAudit,
} from "./enrollmentOperationsSupport.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  ConflictError,
  HttpDomainError,
  NotFoundError,
  ValidationError,
} from "../../lib/httpErrors.js";
import { settleEnrollmentWithdrawal } from "../../finance/use-cases/financeEnrollmentBillingUseCases.js";
import { findTransferTarget, operationWindowError } from "./enrollmentOperationRules.js";
import { offerFreedSeatPostCommit } from "./admissionsWaitlistUseCases.js";
import { assertNoStudentScheduleCollision } from "./enrollmentTimetableGuard.js";

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
    await assertNoStudentScheduleCollision(tenant, session, target.cls.id, [enrollment.studentId]);
    const fee = enrollmentFeeForClass(session.baseFee, target.cls, student ?? {});

    await withTenant(tenant, async (tx) => {
      await repo.applyEnrollmentTransfer(tenant, {
        enrollmentId: enrollment.id,
        from: { classId: enrollment.classId, sectionId: enrollment.sectionId ?? null },
        to: { classId: target.cls.id, className: target.cls.name, sectionId: target.sectionId },
        fee,
        effectiveOn: input.effectiveOn,
        reason: input.reason,
        actor: actorOf(user),
      });
      await recordOperationAudit(tx, tenant, user, enrollment, "transfer", {
        fromClassId: enrollment.classId,
        toClassId: target.cls.id,
        toSectionId: target.sectionId,
        fromFinalFee: enrollment.finalFee,
        toFinalFee: fee.finalFee,
        effectiveOn: input.effectiveOn,
        reason: input.reason,
      });
    });
    return afterChange(tenant, enrollment);
  },

  async withdraw(
    tenant: string,
    id: string,
    body: EnrollmentWithdrawBody,
    user: User,
  ): Promise<{ enrollment: Enrollment; billing: WithdrawalBillingOutcome }> {
    const input = enrollmentWithdrawBodySchema.parse(body);
    const { enrollment, session, placements, today } = await loadOperable(tenant, id);
    const effectiveOn = input.effectiveOn ?? today;
    const endAs = input.endAs ?? "withdrawn";
    const windowError = operationWindowError(enrollment, placements, effectiveOn, today);
    if (windowError) throw new ValidationError(windowError);
    const targetClass = session.classes?.find((cls) => cls.id === enrollment.classId);
    const dropError = dropDeadlineError(targetClass?.dropDeadline, effectiveOn);
    if (dropError && !input.overrideDropDeadline) {
      throw new HttpDomainError(409, "drop_deadline_passed", dropError);
    }
    const billing = await withTenant(tenant, async (tx) => {
      await repo.applyEnrollmentWithdrawal(tenant, {
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        effectiveOn,
        reason: input.reason,
        actor: actorOf(user),
        status: endAs,
      });
      // Last month is charged in full; later untouched invoices are cancelled (decision 2026-10-19).
      const settled = await settleEnrollmentWithdrawal(enrollment.id, effectiveOn);
      await recordOperationAudit(tx, tenant, user, enrollment, endAs, {
        effectiveOn,
        reason: input.reason,
        endAs,
        cancelledInvoiceIds: settled.cancelled.map((invoice) => invoice.id),
        invoicesForReview: settled.review.map((invoice) => invoice.id),
      });
      return settled;
    });
    // A cancellation is a removal (no seat offer); a withdrawal frees the seat for the waitlist.
    if (endAs === "withdrawn") {
      await offerFreedSeatPostCommit(tenant, enrollment.classId);
    }
    const after = await afterChange(tenant, enrollment);
    return { enrollment: after, billing };
  },

  /**
   * Ends a bounded set of enrollments through {@link withdraw} — one row at a time, so each
   * row keeps its own transaction and its own side effects. Partial success is explicit
   * (`failures[]`) instead of the previous N raw status writes from the UI.
   */
  async bulkEnd(
    tenant: string,
    body: unknown,
    user: User,
  ): Promise<{
    succeeded: number;
    failed: number;
    failures: Array<{ id: string; message: string }>;
  }> {
    const input = enrollmentBulkEndBodySchema.parse(body);
    const result = {
      succeeded: 0,
      failed: 0,
      failures: [] as Array<{ id: string; message: string }>,
    };
    for (const id of [...new Set(input.ids.map((value) => String(value).trim()).filter(Boolean))]) {
      try {
        await this.withdraw(
          tenant,
          id,
          {
            reason: input.reason,
            effectiveOn: input.effectiveOn,
            endAs: input.endAs,
            overrideDropDeadline: input.overrideDropDeadline,
          },
          user,
        );
        result.succeeded += 1;
      } catch (error) {
        result.failed += 1;
        result.failures.push({
          id,
          message: error instanceof Error ? error.message : "Could not end the enrollment",
        });
      }
    }
    return result;
  },
};
