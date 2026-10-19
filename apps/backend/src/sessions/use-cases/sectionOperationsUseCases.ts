import {
  isSessionReadOnly,
  sectionCloseBodySchema,
  sectionMergeBodySchema,
  sectionMergeShortfall,
  sectionSplitBodySchema,
  type SectionCloseBody,
  type SectionMergeBody,
  type SectionOperationResult,
  type SectionSplitBody,
  type User,
} from "@mms/shared";
import { sessionsAcademicRepository as repo } from "../repository/sessionsAcademicRepositoryAdapter.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { workspaceToday } from "./sessionLockGuard.js";

async function loadOpenSection(tenant: string, sectionId: string, effectiveOn: string) {
  const roster = await repo.loadSectionRoster(tenant, sectionId);
  if (!roster) throw new NotFoundError("Section not found");
  if (roster.section.status !== "active") throw new ConflictError("The section is already closed");
  const session = await repo.findSessionById(tenant, roster.section.sessionId);
  if (!session) throw new NotFoundError("Session not found");
  if (isSessionReadOnly(session.status))
    throw new ConflictError("The session is closed; its sections are read-only");
  if (effectiveOn > (await workspaceToday(tenant)))
    throw new ValidationError("The effective date cannot be in the future");
  return { ...roster, session };
}

async function afterChange(
  tenant: string,
  user: User,
  sectionId: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: "session_class_sections",
    recordId: sectionId,
    actionType: "UPDATE",
    realUserId: user.id,
    newState: detail,
  });
  await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
  await broadcastCollection("sessions");
  await broadcastCollection("enrollments");
}

const actorOf = (user: User) => ({ userId: user.id, label: user.name || user.email });

/** Section merge / split / close (Phase 9d): dated placement moves, sections closed, never deleted. */
export const sectionOperationsUseCases = {
  async merge(
    tenant: string,
    sectionId: string,
    body: SectionMergeBody,
    user: User,
  ): Promise<SectionOperationResult> {
    const input = sectionMergeBodySchema.parse(body);
    if (input.targetSectionId === sectionId)
      throw new ValidationError("Choose a different section to merge into");
    const {
      section: source,
      enrollmentIds,
      session,
    } = await loadOpenSection(tenant, sectionId, input.effectiveOn);
    const target = await repo.loadSectionRoster(tenant, input.targetSectionId);
    if (!target || target.section.classId !== source.classId)
      throw new ValidationError("The target must be another section of the same class");
    if (target.section.status !== "active") throw new ConflictError("The target section is closed");
    const enrolled = session.classes
      .find((cls) => cls.id === source.classId)
      ?.sections?.find((row) => row.id === target.section.id)?.enrolled;
    const missing = sectionMergeShortfall(enrollmentIds.length, {
      capacity: target.section.capacity,
      enrolled: enrolled ?? target.enrollmentIds.length,
    });
    if (missing > 0)
      throw new ConflictError(
        `${target.section.name} needs ${missing} more seat(s); raise its capacity first`,
      );
    const moved = await repo.applySectionMerge(tenant, {
      source,
      target: target.section,
      effectiveOn: input.effectiveOn,
      reason: input.reason,
      actor: actorOf(user),
    });
    await afterChange(tenant, user, sectionId, { operation: "merge", ...input, moved });
    return { sectionId: target.section.id, moved };
  },

  async split(
    tenant: string,
    sectionId: string,
    body: SectionSplitBody,
    user: User,
  ): Promise<SectionOperationResult> {
    const input = sectionSplitBodySchema.parse(body);
    const { section: source, enrollmentIds } = await loadOpenSection(
      tenant,
      sectionId,
      input.effectiveOn,
    );
    const live = new Set(enrollmentIds);
    const chosen = [...new Set(input.enrollmentIds)];
    if (chosen.some((id) => !live.has(id)))
      throw new ValidationError("Only students currently in this section can be moved");
    if (chosen.length > input.capacity)
      throw new ValidationError("The new section's capacity is smaller than the students moved");
    try {
      const newSectionId = await repo.applySectionSplit(tenant, {
        source,
        name: input.name,
        capacity: input.capacity,
        enrollmentIds: chosen,
        effectiveOn: input.effectiveOn,
        reason: input.reason,
        actor: actorOf(user),
      });
      await afterChange(tenant, user, sectionId, {
        operation: "split",
        newSectionId,
        moved: chosen.length,
        effectiveOn: input.effectiveOn,
        reason: input.reason,
      });
      return { sectionId: newSectionId, moved: chosen.length };
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictError(`A section named ${input.name} already exists in this class`);
      throw error;
    }
  },

  async close(
    tenant: string,
    sectionId: string,
    body: SectionCloseBody,
    user: User,
  ): Promise<SectionOperationResult> {
    const input = sectionCloseBodySchema.parse(body);
    await loadOpenSection(tenant, sectionId, input.effectiveOn);
    const stillEnrolled = await repo.applySectionClose(tenant, {
      sectionId,
      effectiveOn: input.effectiveOn,
      reason: input.reason,
    });
    if (stillEnrolled > 0)
      throw new ConflictError(
        `${stillEnrolled} student(s) are still in this section; merge or move them first`,
      );
    await afterChange(tenant, user, sectionId, { operation: "close", ...input });
    return { sectionId, moved: 0 };
  },
};
