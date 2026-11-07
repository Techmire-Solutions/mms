import { randomUUID } from "node:crypto";
import {
  normalizeSessionStatus,
  sessionRolloverBodySchema,
  type PromotionPreviewRow,
  type Session,
  type SessionRolloverBody,
  type SessionRolloverInput,
  type SessionRolloverRun,
} from "@mms/shared";
import { sessionsRepository } from "../repository/sessionsRepositoryAdapter.js";
import { withTenant } from "../../db/tenant-context.js";
import { sessionRolloverRepository as runs } from "../repository/sessionRolloverRepositoryAdapter.js";
import { listRolloverCandidates } from "../../enrollments/use-cases/enrollmentRolloverUseCases.js";
import { enqueueBackgroundJob } from "../../services/backgroundJobWorkerService.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { planRollover } from "./sessionRolloverPlan.js";

/** Background job kind; the runner key is `sessions:promote`. */
export const SESSION_ROLLOVER_JOB_KIND = "promote";

/** Payload persisted with the queued job (the run row holds the status and counts). */
export interface SessionRolloverJobPayload {
  runId: string;
  sourceSessionId: string;
  body: SessionRolloverBody;
}

const PROMOTABLE_STATES = new Set(["in_progress", "completed"]);

async function loadSource(tenant: string, sessionId: string): Promise<Session> {
  const source = await sessionsRepository.findSessionById(tenant, sessionId);
  if (!source || source.deletedAt) throw new NotFoundError("Session not found");
  return source;
}

function assertClassMap(source: Session, body: SessionRolloverBody): void {
  const ids = new Set(source.classes.map((cls) => cls.id));
  const unknown = body.classMap.some(
    (row) => !ids.has(row.sourceClassId) || (row.nextClassId !== null && !ids.has(row.nextClassId)),
  );
  if (unknown) throw new ValidationError("The class map names a class outside this session");
  // Duplicate source classes would hit the class-map primary key (500); reject them as a 400.
  const seen = new Set<string>();
  for (const row of body.classMap) {
    if (seen.has(row.sourceClassId))
      throw new ValidationError(`The class map names ${row.sourceClassId} twice`);
    seen.add(row.sourceClassId);
  }
}

function createSessionRolloverUseCases() {
  return {
    /** Outcome per live student with eligibility problems, before anything is written. */
    async preview(
      tenant: string,
      sessionId: string,
      input: SessionRolloverInput,
    ): Promise<PromotionPreviewRow[]> {
      const body = sessionRolloverBodySchema.parse(input);
      const source = await loadSource(tenant, sessionId);
      assertClassMap(source, body);
      if (body.mode === "duplicate") return [];
      const candidates = await listRolloverCandidates(tenant, sessionId);
      return planRollover(source, body, candidates).map(
        ({ fromSectionId: _section, ...row }) => row,
      );
    },

    /** Records the run and queues it; the job creates the draft session and moves students. */
    async start(
      tenant: string,
      sessionId: string,
      input: SessionRolloverInput,
      actorUserId: string,
      options: { canOverride?: boolean } = {},
    ): Promise<SessionRolloverRun> {
      const body = sessionRolloverBodySchema.parse(input);
      const source = await loadSource(tenant, sessionId);
      assertClassMap(source, body);
      const sourceState = normalizeSessionStatus(source.status);
      if (body.mode === "promote" && !PROMOTABLE_STATES.has(sourceState))
        throw new ConflictError("Only a session in progress or completed can be promoted");
      // Promote closes every source enrollment: completing the source is routine, but doing it
      // from an in-progress session is a destructive override (review finding R9).
      if (body.mode === "promote" && sourceState !== "completed" && !options.canOverride)
        throw new ConflictError(
          "Promoting an in-progress session closes its enrollments; complete the session first or use the override permission",
        );
      // Abandoned queued/running runs would block every future rollover; recover them first.
      await runs.failStaleRuns(tenant);
      const runId = randomUUID();
      let jobId = "";
      // One transaction for run + job + job id: an enqueue failure must not leave a stuck run.
      await withTenant(tenant, async () => {
        const created = await runs.createPromotionRun(tenant, {
          id: runId,
          sourceSessionId: sessionId,
          mode: body.mode,
          classMap: body.classMap,
          createdBy: actorUserId,
        });
        if (!created) throw new ConflictError("A rollover for this session is already running");
        const payload: SessionRolloverJobPayload = { runId, sourceSessionId: sessionId, body };
        const job = await enqueueBackgroundJob(
          tenant,
          actorUserId,
          {
            id: runId,
            moduleId: "sessions",
            kind: SESSION_ROLLOVER_JOB_KIND,
            status: "running",
            label: `${body.mode === "promote" ? "Promote" : "Duplicate"} ${source.name} → ${body.target.name}`,
            createdAt: new Date().toISOString(),
          },
          payload,
        );
        jobId = job.id;
        await runs.updatePromotionRun(tenant, runId, { jobId });
      });
      return {
        id: runId,
        sourceSessionId: sessionId,
        targetSessionId: null,
        mode: body.mode,
        status: "queued",
        promoted: 0,
        retained: 0,
        graduated: 0,
        left: 0,
        error: null,
        jobId,
      };
    },

    listRuns(tenant: string, sessionId: string): Promise<SessionRolloverRun[]> {
      return runs.listPromotionRuns(tenant, sessionId);
    },
  };
}

export const sessionRolloverUseCases = createSessionRolloverUseCases();
