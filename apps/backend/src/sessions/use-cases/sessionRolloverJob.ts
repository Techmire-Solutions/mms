import {
  PROMOTION_OUTCOME_STATUS,
  sessionRolloverBodySchema,
  type SessionRolloverBody,
} from "@mms/shared";
import { z } from "zod";
import { sessionsRepository } from "../repository/sessionsRepositoryAdapter.js";
import { sessionRolloverRepository as runs } from "../repository/sessionRolloverRepositoryAdapter.js";
import {
  carryRolloverEnrollments,
  closeRolloverSourceEnrollment,
  listRolloverCandidates,
} from "../../enrollments/use-cases/enrollmentRolloverUseCases.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { HttpDomainError, NotFoundError } from "../../lib/httpErrors.js";
import { planRollover, rolloverTargetSection } from "./sessionRolloverPlan.js";
import { workspaceToday } from "./sessionLockGuard.js";
import { registerBackgroundJobRunner } from "../../services/backgroundJobWorkerService.js";
import { transitionSession } from "./sessionTransitionService.js";
import {
  deterministicRolloverId,
  ensureTarget,
  type RolloverWarn,
} from "./sessionRolloverTarget.js";
import {
  SESSION_ROLLOVER_JOB_KIND,
  type SessionRolloverJobPayload,
} from "./sessionRolloverUseCases.js";

type Progress = (current: number, total: number) => Promise<void>;

/** Outcome counts the run records, keyed by the source-enrollment status they produce. */
type PromotionCounts = Record<"promoted" | "retained" | "graduated" | "left", number>;

/**
 * Runs one rollover with durable phase markers:
 * claim → structure → staff → calendar → carry → close sources → finalise source → completed.
 * A retry takes over a stale run and resumes at the first unfinished phase; deterministic ids make
 * every write idempotent (`sessionRolloverTarget.ts`).
 */
export async function executeSessionRollover(
  tenant: string,
  actorUserId: string,
  payload: SessionRolloverJobPayload,
  progress: Progress,
): Promise<{ targetSessionId: string; carried: number }> {
  const { runId } = payload;
  const claimed = await runs.claimPromotionRun(tenant, runId);
  if (!claimed) {
    // Another worker owns the run, or it already completed. Never start a second target.
    const run = await runs.findPromotionRun(tenant, runId);
    if (!run) throw new NotFoundError("Rollover run not found");
    return { targetSessionId: run.targetSessionId ?? "", carried: 0 };
  }
  const warnings: RolloverWarn = async (warning) => {
    await runs.recordRunWarning(tenant, runId, warning.kind, warning.detail);
  };

  try {
    const source = await sessionsRepository.findSessionByIdPrimary(tenant, payload.sourceSessionId);
    if (!source) throw new NotFoundError("Session not found");
    const { target, ids } = await ensureTarget(
      tenant,
      runId,
      source,
      payload,
      actorUserId,
      warnings,
    );
    const counts: PromotionCounts = { promoted: 0, retained: 0, graduated: 0, left: 0 };
    let carried = 0;

    if (payload.body.mode === "promote") {
      const candidates = await listRolloverCandidates(tenant, source.id);
      const plan = planRollover(source, payload.body, candidates);
      // PRIMARY read: a retry must see the rows this run already wrote (finding R2).
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
      const carry = await carryRolloverEnrollments(tenant, target, placements, {
        idFor: (sourceEnrollmentId) =>
          deterministicRolloverId(runId, "enrollment", sourceEnrollmentId),
      });
      carried = carry.created;

      const lastDay = source.endDate || (await workspaceToday(tenant));
      const actor = { userId: actorUserId, label: "Session rollover" };
      for (const [index, row] of plan.entries()) {
        const candidate = byId.get(row.enrollmentId);
        if (!candidate) continue;
        const status = PROMOTION_OUTCOME_STATUS[row.outcome] as keyof PromotionCounts;
        const alreadyCarried = done.has(row.enrollmentId);
        const carryOutcome = row.outcome === "promote" || row.outcome === "retain";
        if (carryOutcome && !alreadyCarried && !carry.carriedSourceIds.has(row.enrollmentId)) {
          // Never close a student who has no target enrollment (finding R3).
          await warnings({
            kind: "carry_skipped",
            detail: `${candidate.studentName} was not carried (no target class/section)`,
          });
          continue;
        }
        if (!alreadyCarried) {
          await closeRolloverSourceEnrollment(tenant, {
            enrollmentId: candidate.id,
            studentId: candidate.studentId,
            status: PROMOTION_OUTCOME_STATUS[row.outcome] as
              "promoted" | "retained" | "graduated" | "left",
            lastDay,
            actor,
          });
        }
        counts[status] += 1;
        await progress(index + 1, plan.length);
      }

      if (payload.body.closeSource !== false) {
        try {
          await transitionSession(tenant, source.id, {
            to: "completed",
            reason: "Rollover completed",
            actor: { userId: actorUserId, label: "Session rollover" },
          });
        } catch (error) {
          if (error instanceof HttpDomainError) {
            await warnings({ kind: "source_not_finalised", detail: error.message });
          } else {
            throw error;
          }
        }
      }
    }

    await runs.updatePromotionRun(tenant, runId, { status: "completed", ...counts, error: null });
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

// Keep the serialised body type in the module surface for the router/contract.
export type { SessionRolloverBody };
