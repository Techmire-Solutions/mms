import { randomUUID } from "node:crypto";
import {
  PROMOTION_OUTCOME_STATUS,
  buildRolloverSession,
  isoDayOffset,
  sessionRolloverBodySchema,
  type RolloverIdMaps,
  type Session,
} from "@mms/shared";
import { z } from "zod";
import { sessionsRepository } from "../repository/sessionsRepositoryAdapter.js";
import { sessionsAcademicRepository as academic } from "../repository/sessionsAcademicRepositoryAdapter.js";
import { sessionRolloverRepository as runs } from "../repository/sessionRolloverRepositoryAdapter.js";
import {
  carryRolloverEnrollments,
  closeRolloverSourceEnrollment,
  listRolloverCandidates,
} from "../../enrollments/use-cases/enrollmentRolloverUseCases.js";
import { copySessionCalendarEvents } from "../../attendance/use-cases/academicCalendarCopyUseCases.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { planRollover, rolloverTargetSection } from "./sessionRolloverPlan.js";
import { workspaceToday } from "./sessionLockGuard.js";
import { registerBackgroundJobRunner } from "../../services/backgroundJobWorkerService.js";
import {
  SESSION_ROLLOVER_JOB_KIND,
  type SessionRolloverJobPayload,
} from "./sessionRolloverUseCases.js";

type Progress = (current: number, total: number) => Promise<void>;

/** Id maps of an earlier attempt's target, matched by class and section name. */
function mapsByName(source: Session, target: Session): RolloverIdMaps {
  const ids: RolloverIdMaps = { classIds: new Map(), sectionIds: new Map() };
  for (const cls of source.classes) {
    const copy = target.classes.find((candidate) => candidate.name === cls.name);
    if (!copy) continue;
    ids.classIds.set(cls.id, copy.id);
    for (const section of cls.sections ?? []) {
      const match = copy.sections?.find((candidate) => candidate.name === section.name);
      if (match) ids.sectionIds.set(section.id, match.id);
    }
  }
  return ids;
}

async function copySectionStaff(
  tenant: string,
  sectionIds: ReadonlyMap<string, string>,
  startOn: string,
  actorUserId: string,
): Promise<void> {
  for (const [sourceSectionId, targetSectionId] of sectionIds) {
    const current = (await academic.listSectionStaff(tenant, sourceSectionId)).filter(
      (row) => row.endOn === null,
    );
    for (const row of current) {
      try {
        await academic.assignSectionStaff(
          tenant,
          targetSectionId,
          {
            facultyId: row.facultyId,
            role: row.role,
            subjectId: row.subjectId,
            startOn,
            reason: "Copied in a session rollover",
          },
          actorUserId,
        );
      } catch (error) {
        // A teacher who has since left (or a clash) is skipped; staff can assign one later.
        if (!(error instanceof ValidationError || error instanceof ConflictError)) throw error;
      }
    }
  }
}

/** Creates (or, on a retry, reuses) the draft target session with its staff and calendar. */
async function ensureTarget(
  tenant: string,
  runId: string,
  source: Session,
  payload: SessionRolloverJobPayload,
  actorUserId: string,
): Promise<{ target: Session; ids: RolloverIdMaps }> {
  const run = await runs.findPromotionRun(tenant, runId);
  const existing = run?.targetSessionId
    ? await sessionsRepository.findSessionById(tenant, run.targetSessionId)
    : null;
  if (existing) return { target: existing, ids: mapsByName(source, existing) };
  const built = buildRolloverSession(source, payload.body, randomUUID);
  await sessionsRepository.saveSession(tenant, built.session);
  await runs.updatePromotionRun(tenant, runId, { targetSessionId: built.session.id });
  const { startDate, endDate } = payload.body.target;
  if (payload.body.copy.staff)
    await copySectionStaff(tenant, built.ids.sectionIds, startDate, actorUserId);
  if (payload.body.copy.calendar && source.startDate)
    await copySessionCalendarEvents(tenant, {
      sourceSessionId: source.id,
      targetSessionId: built.session.id,
      range: { from: source.startDate, to: source.endDate || endDate },
      offsetDays: isoDayOffset(source.startDate, startDate),
      classIds: built.ids.classIds,
      sectionIds: built.ids.sectionIds,
      actorUserId,
    });
  // The built copy carries every id the promotion needs; no read-back (replica lag).
  return { target: built.session, ids: built.ids };
}

/** Runs one rollover: draft session, then (promote) carried enrollments and source outcomes. */
export async function executeSessionRollover(
  tenant: string,
  actorUserId: string,
  payload: SessionRolloverJobPayload,
  progress: Progress,
): Promise<{ targetSessionId: string; carried: number }> {
  const { runId } = payload;
  await runs.updatePromotionRun(tenant, runId, { status: "running", error: null });
  try {
    const source = await sessionsRepository.findSessionById(tenant, payload.sourceSessionId);
    if (!source) throw new NotFoundError("Session not found");
    const { target, ids } = await ensureTarget(tenant, runId, source, payload, actorUserId);
    const counts = { promoted: 0, retained: 0, graduated: 0, left: 0 };
    let carried = 0;
    if (payload.body.mode === "promote") {
      const candidates = await listRolloverCandidates(tenant, source.id);
      const plan = planRollover(source, payload.body, candidates);
      const done = await runs.findPromotedSourceIds(
        tenant,
        target.id,
        plan.map((row) => row.enrollmentId),
      );
      const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const placements = plan.flatMap((row) => {
        const candidate = byId.get(row.enrollmentId);
        const targetClassId = row.toClassId ? ids.classIds.get(row.toClassId) : undefined;
        if (!candidate || !targetClassId || done.has(row.enrollmentId)) return [];
        const sectionId = rolloverTargetSection(row, source, target, targetClassId, ids.sectionIds);
        return [{ candidate, targetClassId, targetSectionId: sectionId }];
      });
      carried = await carryRolloverEnrollments(tenant, target, placements);
      const lastDay = source.endDate || (await workspaceToday(tenant));
      const actor = { userId: actorUserId, label: "Session rollover" };
      for (const [index, row] of plan.entries()) {
        const candidate = byId.get(row.enrollmentId);
        if (!candidate) continue;
        const status = PROMOTION_OUTCOME_STATUS[row.outcome];
        await closeRolloverSourceEnrollment(tenant, {
          enrollmentId: candidate.id,
          studentId: candidate.studentId,
          status,
          lastDay,
          actor,
        });
        counts[status] += 1;
        await progress(index + 1, plan.length);
      }
    }
    await runs.updatePromotionRun(tenant, runId, { status: "completed", ...counts });
    await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
    await broadcastCollection("sessions");
    return { targetSessionId: target.id, carried };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rollover failed";
    await runs.updatePromotionRun(tenant, runId, {
      status: "failed",
      error: message.slice(0, 1000),
    });
    throw error;
  }
}

const jobPayloadSchema = z
  .object({
    runId: z.string().min(1),
    sourceSessionId: z.string().min(1),
    body: sessionRolloverBodySchema,
  })
  .strict();

/** Registers the `sessions:promote` background job runner. */
export function registerSessionRolloverJobRunner(): void {
  registerBackgroundJobRunner(`sessions:${SESSION_ROLLOVER_JOB_KIND}`, async (payload, ctx) => {
    const parsed = jobPayloadSchema.parse(payload);
    const result = await executeSessionRollover(ctx.tenant, ctx.userId, parsed, (current, total) =>
      ctx.updateProgress(current, Math.max(total, 1)),
    );
    await ctx.complete({
      label: `Rollover complete — ${result.carried} students carried`,
      progress: { current: result.carried, total: Math.max(result.carried, 1) },
    });
  });
}
