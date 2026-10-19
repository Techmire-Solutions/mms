import {
  enrollmentHoldsSeat,
  enrollmentTransferBodySchema,
  enrollmentWithdrawBodySchema,
  isSessionReadOnly,
  normalizeEnrollmentModulePreferences,
  type Enrollment,
  type EnrollmentPlacement,
  type EnrollmentTransferBody,
  type EnrollmentWithdrawBody,
  type User,
} from "@mms/shared";
import { enrollmentOperationsRepository as repo } from "../repository/enrollmentOperationsRepositoryAdapter.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { findTransferTarget, operationWindowError } from "./enrollmentOperationRules.js";

async function loadOperable(tenant: string, id: string) {
  const enrollment = await repo.findEnrollmentById(tenant, id);
  if (!enrollment || enrollment.deletedAt) throw new NotFoundError("Enrollment not found");
  if (!enrollmentHoldsSeat(enrollment.status) || enrollment.status === "completed")
    throw new ConflictError(`A ${enrollment.status} enrollment cannot be changed`);
  const session = await repo.findSessionById(tenant, enrollment.sessionId);
  if (!session) throw new NotFoundError("Session not found");
  if (isSessionReadOnly(session.status))
    throw new ConflictError("The session is closed; its enrollments are read-only");
  const placements = await repo.listEnrollmentPlacements(tenant, enrollment.id);
  const today = todayInTimeZone(await repo.findWorkspaceTimezone(tenant));
  return { enrollment, session, placements, today };
}

async function afterChange(
  tenant: string,
  user: User,
  before: Enrollment,
  action: string,
  detail: Record<string, unknown>,
): Promise<Enrollment> {
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: "enrollments",
    recordId: before.id,
    actionType: "UPDATE",
    realUserId: user.id,
    newState: { operation: action, ...detail },
  });
  await invalidateMultiTierCache({ tenantId: tenant, domain: "students" });
  await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
  await broadcastCollection("enrollments");
  await broadcastCollection("sessions");
  const after = await repo.findEnrollmentById(tenant, before.id);
  if (!after) throw new NotFoundError("Enrollment not found");
  return after;
}

const actorOf = (user: User) => ({ userId: user.id, label: user.name || user.email });

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

    await repo.applyEnrollmentTransfer(tenant, {
      enrollmentId: enrollment.id,
      from: { classId: enrollment.classId, sectionId: enrollment.sectionId ?? null },
      to: { classId: target.cls.id, className: target.cls.name, sectionId: target.sectionId },
      effectiveOn: input.effectiveOn,
      reason: input.reason,
      actor: actorOf(user),
    });
    return afterChange(tenant, user, enrollment, "transfer", {
      fromClassId: enrollment.classId,
      toClassId: target.cls.id,
      toSectionId: target.sectionId,
      effectiveOn: input.effectiveOn,
      reason: input.reason,
    });
  },

  async withdraw(
    tenant: string,
    id: string,
    body: EnrollmentWithdrawBody,
    user: User,
  ): Promise<Enrollment> {
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
    return afterChange(tenant, user, enrollment, "withdraw", {
      effectiveOn: input.effectiveOn,
      reason: input.reason,
    });
  },
};
