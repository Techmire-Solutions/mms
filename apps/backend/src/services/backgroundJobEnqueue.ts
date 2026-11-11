import { BACKGROUND_JOBS_MAX_PER_USER, type BackgroundJobRecord } from "@mms/shared";
import { logger } from "../lib/logger.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { patchJob } from "./backgroundJobPatch.js";
import { markJobPermanentlyFailed } from "./backgroundJobTerminalState.js";
import {
  BackgroundJobLimitError,
  countUserBackgroundJobs,
  createDatabaseBackgroundJob,
  getUserBackgroundJob,
} from "./backgroundJobService.js";
import { dispatchJobToQueue, QueuePayloadTooLargeError } from "../worker/queues/index.js";
import { executeJob } from "./backgroundJobWorkerService.js";

export class QueueUnavailableError extends Error {
  constructor(
    message = "Failed to enqueue background job. The task queue service may be unavailable.",
  ) {
    super(message);
    this.name = "QueueUnavailableError";
  }
}

/**
 * Re-runs a failed job with the payload from the new request.
 *
 * `patchJob` clears the stored payload on a terminal status (CSV rows are PII), so the caller passes
 * the payload it is about to enqueue. Every examination runner is replay-safe (deterministic ids,
 * OCC, artifact overwrite, audit delta), so a retry applies the same work instead of duplicating it.
 */
export async function retryFailedBackgroundJob(
  tenant: string,
  userId: string,
  job: BackgroundJobRecord,
  payload: unknown,
): Promise<BackgroundJobRecord> {
  if (job.status !== "failed") return job;

  const reset = { ...job, status: "pending" as const, error: undefined, completedAt: undefined };
  await patchJob(tenant, userId, job.id, {
    status: "pending",
    error: null,
    completedAt: null,
    deadLetteredAt: null,
  });

  const dispatched = await dispatchJobToQueue(tenant, userId, reset, payload, {
    replaceExisting: true,
  });
  if (!dispatched) {
    await patchJob(tenant, userId, job.id, {
      status: "failed",
      error: "Queue unavailable while retrying the job",
      completedAt: new Date().toISOString(),
    }).catch(() => undefined);
    throw new QueueUnavailableError();
  }
  return reset;
}

/** Persists a running job and delegates execution to the out-of-process worker queue. */
export async function enqueueBackgroundJob(
  tenant: string,
  userId: string,
  job: BackgroundJobRecord,
  payload: unknown,
): Promise<BackgroundJobRecord> {
  const pendingJob: BackgroundJobRecord = { ...job, status: "pending" };

  const retained = await countUserBackgroundJobs(userId);
  if (retained >= BACKGROUND_JOBS_MAX_PER_USER) {
    throw new BackgroundJobLimitError(BACKGROUND_JOBS_MAX_PER_USER);
  }

  const inserted = await runWithTenant(tenant, () =>
    createDatabaseBackgroundJob(tenant, userId, pendingJob, payload),
  );
  if (!inserted) {
    // A concurrent identical submit won the insert race: return its job instead of a 500.
    const existing = await getUserBackgroundJob(userId, pendingJob.id, tenant);
    if (existing) return existing;
    throw new QueueUnavailableError("Background job could not be created; retry the request");
  }

  let enqueued: boolean;
  try {
    enqueued = await dispatchJobToQueue(tenant, userId, pendingJob, payload);
  } catch (error) {
    if (error instanceof QueuePayloadTooLargeError) {
      await markJobPermanentlyFailed(
        tenant,
        userId,
        pendingJob.id,
        pendingJob.moduleId,
        pendingJob.kind,
        "Background job payload is too large.",
      );
      throw new QueueUnavailableError("Background job payload is too large.");
    }
    throw error;
  }

  if (!enqueued) {
    // Heavy export/PDF jobs must not run on the API event loop: the sandboxed worker owns the heap
    // ceiling, execution timeout, retry/backoff and DLQ. Fail the job and let the caller surface a
    // 503, unless an operator explicitly opted into the dev-only in-process fallback.
    if (process.env.MMS_ALLOW_IN_PROCESS_JOB_FALLBACK === "true") {
      logger.warn(
        { jobId: pendingJob.id, moduleId: pendingJob.moduleId, kind: pendingJob.kind },
        "Queue service unavailable; MMS_ALLOW_IN_PROCESS_JOB_FALLBACK is set — running in-process (no sandbox, no retry/DLQ)",
      );
      setImmediate(() => {
        executeJob(
          tenant,
          userId,
          pendingJob.id,
          pendingJob.moduleId,
          pendingJob.kind,
          payload,
        ).catch((err) => {
          logger.error(
            { jobId: pendingJob.id, err },
            "In-process fallback background job execution failed",
          );
        });
      });
      return pendingJob;
    }

    logger.error(
      { jobId: pendingJob.id, moduleId: pendingJob.moduleId, kind: pendingJob.kind },
      "Queue service unavailable (Redis unreachable or timed out); rejecting background job",
    );
    await markJobPermanentlyFailed(
      tenant,
      userId,
      pendingJob.id,
      pendingJob.moduleId,
      pendingJob.kind,
      "Background job queue is unavailable.",
    );
    throw new QueueUnavailableError();
  }

  return pendingJob;
}
