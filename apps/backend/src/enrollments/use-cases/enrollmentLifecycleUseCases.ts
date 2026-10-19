import {
  enrollmentFeeForClass,
  enrollmentReadmitBodySchema,
  enrollmentSuspendBodySchema,
  type Enrollment,
  type EnrollmentReadmitBody,
  type EnrollmentSuspendBody,
  type User,
} from "@mms/shared";
import { enrollmentOperationsRepository as repo } from "../repository/enrollmentOperationsRepositoryAdapter.js";
import { ConflictError, ValidationError } from "../../lib/httpErrors.js";
import { recordApprovedLeave } from "../../attendance/use-cases/attendanceLeaveUseCases.js";
import { findTransferTarget, readmitWindowError } from "./enrollmentOperationRules.js";
import {
  actorOf,
  afterChange,
  loadEnrollmentInOpenSession,
  loadOperable,
} from "./enrollmentOperationsSupport.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

/** Re-admission and suspension of enrollments (Phase 9c). */
export const enrollmentLifecycleUseCases = {
  /** Withdrawn → confirmed from a date, back into its class (or another of the session). */
  async readmit(
    tenant: string,
    id: string,
    body: EnrollmentReadmitBody,
    user: User,
  ): Promise<Enrollment> {
    const input = enrollmentReadmitBodySchema.parse(body);
    const { enrollment, session, today } = await loadEnrollmentInOpenSession(tenant, id);
    if (enrollment.status !== "withdrawn")
      throw new ConflictError("Only a withdrawn enrollment can be re-admitted");
    const windowError = readmitWindowError(enrollment, input.effectiveOn, today);
    if (windowError) throw new ValidationError(windowError);
    const classId = input.classId ?? enrollment.classId;
    const sectionId =
      input.sectionId !== undefined
        ? input.sectionId
        : classId === enrollment.classId
          ? (enrollment.sectionId ?? null)
          : null;
    const target = findTransferTarget(session, enrollment, classId, sectionId, {
      allowSamePlacement: true,
    });
    if ("error" in target) throw new ValidationError(target.error);
    if (target.seatsLeft !== null && target.seatsLeft <= 0)
      throw new ConflictError(`${target.cls.name} has no free seats`);
    const [student] = await repo.findStudentsByIds(tenant, [enrollment.studentId]);
    const fee = enrollmentFeeForClass(session.baseFee, target.cls, student ?? {});

    await repo.applyEnrollmentReadmission(tenant, {
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      to: { classId: target.cls.id, className: target.cls.name, sectionId: target.sectionId },
      fee,
      effectiveOn: input.effectiveOn,
      reason: input.reason,
      actor: actorOf(user),
    });
    return afterChange(tenant, user, enrollment, "readmit", {
      toClassId: target.cls.id,
      toSectionId: target.sectionId,
      finalFee: fee.finalFee,
      effectiveOn: input.effectiveOn,
      reason: input.reason,
    });
  },

  /** Approved leave range (Attendance) + timeline entry; billing is unchanged by policy. */
  async suspend(
    tenant: string,
    id: string,
    body: EnrollmentSuspendBody,
    user: User,
  ): Promise<Enrollment> {
    const input = enrollmentSuspendBodySchema.parse(body);
    const { enrollment } = await loadOperable(tenant, id);
    const start = enrollment.startOn || enrollment.enrolledDate;
    if (start && ISO_DATE.test(start) && input.fromOn < start.slice(0, 10))
      throw new ValidationError(`The leave cannot start before the enrollment (${start})`);

    await recordApprovedLeave(tenant, {
      studentId: enrollment.studentId,
      fromOn: input.fromOn,
      toOn: input.toOn,
      reason: input.reason,
      approvedBy: user.id,
    });
    await repo.recordEnrollmentSuspension(tenant, {
      enrollmentId: enrollment.id,
      fromOn: input.fromOn,
      toOn: input.toOn,
      reason: input.reason,
      actor: actorOf(user),
    });
    return afterChange(tenant, user, enrollment, "suspend", {
      fromOn: input.fromOn,
      toOn: input.toOn,
      reason: input.reason,
    });
  },
};
