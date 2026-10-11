import { and, eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

export class QueueUnavailableError extends Error {
  constructor(
    message = "Failed to enqueue background job. The task queue service may be unavailable.",
  ) {
    super(message);
    this.name = "QueueUnavailableError";
  }
}
import type { BackgroundJobRecord } from "@mms/shared";
import { runWithTenant } from "../lib/tenantContext.js";
import { getBackgroundJobModuleDenial } from "../lib/backgroundJobModuleAccess.js";
import { withTenant } from "../db/tenant-context.js";
import { backgroundJobs } from "../db/schema.js";
import { rowToJobRecord, createDatabaseBackgroundJob } from "./backgroundJobService.js";
import { dispatchJobToQueue } from "../worker/queues/index.js";
import { publishJobEvent } from "../worker/pubsub/jobPubSub.js";

export interface BackgroundJobRunContext {
  tenant: string;
  userId: string;
  jobId: string;
  signal?: AbortSignal;
  updateProgress: (current: number, total: number) => Promise<void>;
  complete: (patch?: Partial<BackgroundJobRecord>) => Promise<void>;
  fail: (error: string) => Promise<void>;
}

export type BackgroundJobRunner = (
  payload: unknown,
  runContext: BackgroundJobRunContext,
) => Promise<void>;

const runners = new Map<string, BackgroundJobRunner>();

export function registerBackgroundJobRunner(key: string, runner: BackgroundJobRunner): void {
  runners.set(key, runner);
}

async function patchJob(
  tenantId: string,
  _userId: string,
  jobId: string,
  patch: Partial<BackgroundJobRecord>,
): Promise<BackgroundJobRecord> {
  if (!tenantId) throw new Error("Tenant context is required to patch background job");

  const updateValues: {
    status?: string;
    label?: string;
    progressCurrent?: number | null;
    progressTotal?: number | null;
    error?: string | null;
    hasDownload?: boolean;
    completedAt?: Date | null;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (patch.status !== undefined) updateValues.status = patch.status;
  if (patch.label !== undefined) updateValues.label = patch.label;
  if (patch.progress !== undefined) {
    updateValues.progressCurrent = patch.progress.current;
    updateValues.progressTotal = patch.progress.total;
  }
  if (patch.error !== undefined) updateValues.error = patch.error;
  if (patch.hasDownload !== undefined) updateValues.hasDownload = patch.hasDownload;
  if (patch.completedAt !== undefined) {
    updateValues.completedAt = patch.completedAt ? new Date(patch.completedAt) : null;
  }

  const [updated] = await withTenant(tenantId, async (tx) => {
    return tx
      .update(backgroundJobs)
      .set(updateValues)
      .where(and(eq(backgroundJobs.tenantId, tenantId), eq(backgroundJobs.id, jobId)))
      .returning();
  });

  if (!updated) {
    throw new Error(`Background job ${jobId} not found for tenant ${tenantId}`);
  }

  return rowToJobRecord(updated);
}

export async function executeJob(
  tenant: string,
  userId: string,
  jobId: string,
  moduleId: string,
  kind: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) {
    throw new Error(`Background job ${jobId} aborted before execution`);
  }

  const key = `${moduleId}:${kind}`;
  const runner = runners.get(key);

  const runContext: BackgroundJobRunContext = {
    tenant,
    userId,
    jobId,
    signal,
    updateProgress: async (current, total) => {
      await patchJob(tenant, userId, jobId, { progress: { current, total } });
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      await publishJobEvent({
        event: "job-progress",
        tenantId: tenant,
        userId,
        jobId,
        moduleId,
        kind,
        progress: { current, total, percent },
      });
    },
    complete: async (patch) => {
      await patchJob(tenant, userId, jobId, {
        status: "completed",
        completedAt: new Date().toISOString(),
        ...patch,
      });
      await publishJobEvent({
        event: "job-completed",
        tenantId: tenant,
        userId,
        jobId,
        moduleId,
        kind,
        label: patch?.label,
        hasDownload: patch?.hasDownload,
        completedAt: new Date().toISOString(),
      });
    },
    fail: async (error) => {
      await patchJob(tenant, userId, jobId, {
        status: "failed",
        error,
        completedAt: new Date().toISOString(),
      });
      await publishJobEvent({
        event: "job-failed",
        tenantId: tenant,
        userId,
        jobId,
        moduleId,
        kind,
        error,
        completedAt: new Date().toISOString(),
      });
    },
  };

  if (!runner) {
    await runContext.fail(`No runner registered for ${key}`);
    return;
  }

  // Permanent denial: fail without throwing so BullMQ does not retry.
  const denial = await getBackgroundJobModuleDenial(tenant, userId, moduleId, kind);
  if (denial) {
    await runContext.fail(`Module access denied (${denial})`);
    return;
  }

  // Heartbeat: refresh updated_at while the runner is in flight so the startup
  // orphan-cleanup on other replicas can tell a live long-running job from one
  // whose worker actually died.
  const heartbeat = setInterval(() => {
    void patchJob(tenant, userId, jobId, {}).catch(() => {
      // A failed heartbeat must never fail the job itself.
    });
  }, 60_000);
  heartbeat.unref?.();

  try {
    await runWithTenant(tenant, async () => {
      await runner(payload, runContext);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Background job failed";
    await runContext.fail(message);
    // Re-throw so BullMQ applies its retry/backoff policy and the DLQ handler
    // fires on the final attempt. Without this, BullMQ records the job as
    // "completed" even though the DB row says "failed", so retries never run.
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

/**
 * Forcefully fails a job in the database and broadcasts the event.
 * Useful for Dead-Letter Queue (DLQ) handlers when a job exhausts retries.
 */
export async function markJobPermanentlyFailed(
  tenantId: string,
  userId: string,
  jobId: string,
  moduleId: string,
  kind: string,
  error: string,
): Promise<void> {
  await patchJob(tenantId, userId, jobId, {
    status: "failed",
    error,
    completedAt: new Date().toISOString(),
  });

  await publishJobEvent({
    event: "job-failed",
    tenantId,
    userId,
    jobId,
    moduleId,
    kind,
    error,
    completedAt: new Date().toISOString(),
  });
}

/** Persists a running job and delegates execution to the out-of-process worker queue. */
export async function enqueueBackgroundJob(
  tenant: string,
  userId: string,
  job: BackgroundJobRecord,
  payload: unknown,
): Promise<BackgroundJobRecord> {
  // Create job with 'pending' status in PostgreSQL
  const pendingJob: BackgroundJobRecord = {
    ...job,
    status: "pending",
  };
  await runWithTenant(tenant, () =>
    createDatabaseBackgroundJob(tenant, userId, pendingJob, payload),
  );

  // Dispatch to BullMQ Queue
  const enqueued = await dispatchJobToQueue(tenant, userId, pendingJob, payload);

  if (!enqueued) {
    // Heavy export/PDF jobs must not run on the API event loop: the sandboxed
    // worker owns the heap ceiling, execution timeout, retry/backoff and DLQ.
    // Fail the job and let the caller surface a 503, unless an operator has
    // explicitly opted into the dev-only in-process fallback.
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

export { getUserBackgroundJob, getUserBackgroundJobPayload } from "./backgroundJobService.js";
