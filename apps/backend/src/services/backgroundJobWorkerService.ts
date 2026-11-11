import type { BackgroundJobRecord } from "@mms/shared";
import { bindRequestUserId, runWithTenant } from "../lib/tenantContext.js";
import { getBackgroundJobModuleDenial } from "../lib/backgroundJobModuleAccess.js";

import { patchJob } from "./backgroundJobPatch.js";
import { markJobPermanentlyFailed } from "./backgroundJobTerminalState.js";
import { createJobDeadline, runWithJobDeadline } from "./backgroundJobDeadline.js";
import { publishJobEvent } from "../worker/pubsub/jobPubSub.js";

export { markJobPermanentlyFailed };

export interface BackgroundJobRunContext {
  tenant: string;
  userId: string;
  jobId: string;
  signal?: AbortSignal;
  /** 1-based attempt number for this execution (BullMQ `attemptsMade + 1`). */
  attempt?: number;
  /** Configured attempt ceiling (BullMQ `opts.attempts`). */
  maxAttempts?: number;
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

/** Test/ops probe: whether a `${moduleId}:${kind}` runner is registered in this process. */
export function hasBackgroundJobRunner(key: string): boolean {
  return runners.has(key);
}

export async function executeJob(
  tenant: string,
  userId: string,
  jobId: string,
  moduleId: string,
  kind: string,
  payload: unknown,
  signal?: AbortSignal,
  attemptInfo?: { attempt?: number; maxAttempts?: number },
): Promise<void> {
  if (signal?.aborted) {
    throw new Error(`Background job ${jobId} aborted before execution`);
  }

  const key = `${moduleId}:${kind}`;
  const runner = runners.get(key);
  const deadline = createJobDeadline(moduleId, kind, signal);

  const runContext: BackgroundJobRunContext = {
    tenant,
    userId,
    jobId,
    signal: deadline.signal,
    attempt: attemptInfo?.attempt,
    maxAttempts: attemptInfo?.maxAttempts,
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
    deadline.dispose();
    // A missing runner is an operator bug and must not look like a completed job: throwing
    // makes BullMQ retry, then dead-letter and surface the failure in logs/DLQ.
    throw new Error(`No background job runner registered for ${key}`);
  }

  // Permanent denial: fail without throwing so BullMQ does not retry.
  const denial = await getBackgroundJobModuleDenial(tenant, userId, moduleId, kind);
  if (denial) {
    await runContext.fail(`Module access denied (${denial})`);
    deadline.dispose();
    return;
  }

  // Persist the transition out of `pending` before the runner starts. Retries
  // of a previous attempt also re-enter here after a stalled-job recovery.
  await patchJob(tenant, userId, jobId, { status: "running" });

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
    await runWithJobDeadline(deadline, () =>
      runWithTenant(tenant, async () => {
        // Audit rows / `app.current_user_id` must attribute the job to its initiator, not "system".
        bindRequestUserId(userId);
        await runner(payload, runContext);
      }),
    );
  } catch (error) {
    // Deadline/shutdown aborts get a stable message; a real runner failure keeps its own.
    const message =
      deadline.reasonMessage() ??
      (error instanceof Error ? error.message : "Background job failed");
    await runContext.fail(message);
    // Re-throw so BullMQ applies its retry/backoff policy and the DLQ handler
    // fires on the final attempt. Without this, BullMQ records the job as
    // "completed" even though the DB row says "failed", so retries never run.
    throw error;
  } finally {
    clearInterval(heartbeat);
    deadline.dispose();
  }
}

export {
  getUserBackgroundJob,
  getUserBackgroundJobPayload,
  BackgroundJobLimitError,
  countUserBackgroundJobs,
  findLiveBackgroundJobForEntity,
} from "./backgroundJobService.js";
export {
  QueueUnavailableError,
  enqueueBackgroundJob,
  retryFailedBackgroundJob,
} from "./backgroundJobEnqueue.js";
