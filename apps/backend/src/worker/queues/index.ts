import { Queue } from "bullmq";
import type { BackgroundJobRecord } from "@mms/shared";
import {
  QUEUE_PDF_RENDERING,
  QUEUE_BULK_EXPORT,
  QUEUE_MESSAGING_BROADCAST,
  QUEUE_SETTINGS,
  QUEUE_SESSIONS_ROLLOVER,
  DEFAULT_JOB_OPTIONS,
  QUEUE_HASANAT_AWARDS,
  QUEUE_EXAMINATIONS,
  QUEUE_QUESTION_BANK,
  QUEUE_WORKSHOPS,
  getBullMQConnectionOptions,
  getQueuePrefix,
} from "./queueConfig.js";
import {
  calculateTenantFairSharePriority,
  incrementTenantInflightJobs,
} from "./queueTenantInflight.js";
import { stripUndefinedFields } from "../../lib/payloadTrimmer.js";
import { logger } from "../../lib/logger.js";
import { removeRetainedJob } from "./replaceRetainedJob.js";
import { getRedisClient, checkIsRedisConnected } from "../../lib/redis.js";
export const MAX_JOB_PAYLOAD_BYTES = 1024 * 1024; // 1 MB payload ceiling
export const QUEUE_ADD_TIMEOUT_MS = 6000;
export const QUEUE_ADD_RECONCILE_TIMEOUT_MS = 2000;
const QUEUE_ADD_RECONCILE_POLL_MS = 100;

/** Distinguishes our own add deadline from a real Redis error. */
/** Thrown before the job is handed to Redis when its payload exceeds the size ceiling. */
export class QueuePayloadTooLargeError extends Error {
  constructor(
    readonly payloadSize: number,
    readonly maxBytes: number,
  ) {
    super(`Background job payload is ${payloadSize} bytes (maximum ${maxBytes})`);
    this.name = "QueuePayloadTooLargeError";
  }
}

export class QueueAddTimeoutError extends Error {
  constructor() {
    super("BullMQ queue.add timeout (Redis unreachable)");
    this.name = "QueueAddTimeoutError";
  }
}

/**
 * After an `add` deadline, confirm whether Redis eventually accepted the job.
 * `queue.add` is not cancellable, so a timeout is not proof of failure.
 */
export async function reconcileTimedOutQueueAdd(
  queue: Pick<Queue<EnqueuedJobData>, "getJob">,
  jobId: string,
  timeoutMs = QUEUE_ADD_RECONCILE_TIMEOUT_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    try {
      let timer: NodeJS.Timeout;
      const poll = new Promise<null>((_, rej) => {
        timer = setTimeout(() => rej(), Math.min(QUEUE_ADD_RECONCILE_POLL_MS, remaining));
      });
      const getJob = queue.getJob(jobId);
      getJob.catch(() => {});
      const job = await Promise.race([getJob, poll]).finally(() => clearTimeout(timer));
      if (job) return true;
    } catch {
      // Redis may still be reconnecting or poll timed out; keep polling until deadline.
    }
    if (Date.now() >= deadline) return false;
    await new Promise((r) =>
      setTimeout(r, Math.min(QUEUE_ADD_RECONCILE_POLL_MS, Math.max(0, deadline - Date.now()))),
    );
  }
}

export interface EnqueuedJobData {
  jobId: string;
  tenantId: string;
  userId: string;
  moduleId: string;
  kind: string;
  label?: string;
  payload: unknown;
  enqueuedAt: string;
}

const queues = new Map<string, Queue<EnqueuedJobData>>();

export function getQueue(queueName: string): Queue<EnqueuedJobData> {
  let queue = queues.get(queueName);
  if (!queue) {
    const connection = getBullMQConnectionOptions();
    queue = new Queue<EnqueuedJobData>(queueName, {
      connection,
      prefix: getQueuePrefix(),
      defaultJobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        priority: QUEUE_SETTINGS[queueName]?.priority ?? 2,
      },
    });
    queue.on("error", (err) => {
      logger.warn({ queue: queueName, err }, "BullMQ queue connection error");
    });
    queues.set(queueName, queue);
  }
  return queue;
}

export function resolveQueueNameForJob(moduleId: string, kind: string): string {
  const normalizedKind = kind.toLowerCase();
  const normalizedModule = moduleId.toLowerCase();

  if (
    normalizedKind.includes("pdf") ||
    normalizedKind.includes("receipt") ||
    normalizedKind.includes("report-card")
  ) {
    return QUEUE_PDF_RENDERING;
  }

  if (normalizedModule === "sessions" && normalizedKind === "promote") {
    return QUEUE_SESSIONS_ROLLOVER;
  }

  // Points are the module's money: a 10-minute award/import must not occupy a shared export slot.
  if (
    normalizedModule === "hasanat" &&
    (normalizedKind === "bulk-award" || normalizedKind === "import")
  ) {
    return QUEUE_HASANAT_AWARDS;
  }

  if (normalizedModule === "workshops") {
    return QUEUE_WORKSHOPS;
  }

  if (normalizedModule === "examinations") {
    return QUEUE_EXAMINATIONS;
  }

  // Imports/exports and item-analysis rollups are long and DB-heavy: keep them off the shared
  // export queue so they neither wait for nor block another module's export.
  if (normalizedModule === "questionbank") {
    return QUEUE_QUESTION_BANK;
  }

  if (
    normalizedModule === "messaging" ||
    normalizedKind.includes("broadcast") ||
    normalizedKind.includes("sms") ||
    normalizedKind.includes("whatsapp")
  ) {
    return QUEUE_MESSAGING_BROADCAST;
  }

  return QUEUE_BULK_EXPORT;
}

export * from "./queueTenantInflight.js";
export { removeRetainedJob } from "./replaceRetainedJob.js";

/**
 * Dispatches a background job to the appropriate BullMQ queue with tenant fair-share scheduling.
 * Returns true if enqueued to BullMQ, false if Redis is unavailable and should fallback.
 */
export async function dispatchJobToQueue(
  tenantId: string,
  userId: string,
  job: BackgroundJobRecord,
  payload: unknown,
  options?: { replaceExisting?: boolean },
): Promise<boolean> {
  const queueName = resolveQueueNameForJob(job.moduleId, job.kind);
  if (process.env.MMS_ALLOW_IN_PROCESS_JOB_FALLBACK === "true") {
    const client = getRedisClient();
    if (!client || !checkIsRedisConnected()) {
      logger.warn(
        { jobId: job.id, queue: queueName },
        "Redis is not connected; MMS_ALLOW_IN_PROCESS_JOB_FALLBACK is set — bypassing queue enqueue",
      );
      return false;
    }
  }

  const queue = getQueue(queueName);

  const sanitizedPayload = stripUndefinedFields(payload);
  if (sanitizedPayload !== undefined && sanitizedPayload !== null) {
    try {
      const payloadSize = Buffer.byteLength(JSON.stringify(sanitizedPayload), "utf8");
      if (payloadSize > MAX_JOB_PAYLOAD_BYTES) {
        logger.warn(
          { jobId: job.id, queue: queueName, payloadSize, max: MAX_JOB_PAYLOAD_BYTES },
          "Job payload exceeds the 1MB ceiling; rejecting the enqueue",
        );
        throw new QueuePayloadTooLargeError(payloadSize, MAX_JOB_PAYLOAD_BYTES);
      }
    } catch (error) {
      if (error instanceof QueuePayloadTooLargeError) throw error;
      // ignore serialization check failures
    }
  }

  const jobData: EnqueuedJobData = {
    jobId: job.id,
    tenantId,
    userId,
    moduleId: job.moduleId,
    kind: job.kind,
    label: job.label,
    payload: sanitizedPayload,
    enqueuedAt: new Date().toISOString(),
  };

  const fairSharePriority = await calculateTenantFairSharePriority(
    tenantId,
    QUEUE_SETTINGS[queueName]?.priority ?? 2,
  );

  try {
    // Long-running rollover retries resume the same run; the longer backoff avoids
    // overlapping an attempt that is still unwinding after a timeout.
    const longRunningRollover =
      job.moduleId.trim().toLowerCase() === "sessions" &&
      job.kind.trim().toLowerCase() === "promote";
    // Workshop imports are chunked/idempotent; a short 1s retry budget would dead-letter on a
    // transient DB blip, so give them the same longer backoff as rollover.
    const longRunningImport =
      job.moduleId.trim().toLowerCase() === "workshops" &&
      job.kind.trim().toLowerCase() === "import";
    if (options?.replaceExisting) {
      // Replay path: clear the retained job first, otherwise BullMQ dedupes the id and the
      // re-enqueue is silently ignored.
      await removeRetainedJob(queue, job.id);
    }
    const addPromise = queue.add(`${job.moduleId}:${job.kind}`, jobData, {
      jobId: job.id,
      priority: fairSharePriority,
      ...(longRunningRollover || longRunningImport
        ? { attempts: 3, backoff: { type: "exponential" as const, delay: 30_000 } }
        : {}),
    });
    // Guard against unhandled rejections if timeoutPromise wins the race
    addPromise.catch(() => {});

    // Fail fast if Redis is unreachable to prevent API request hanging
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new QueueAddTimeoutError()), QUEUE_ADD_TIMEOUT_MS);
    });

    try {
      await Promise.race([addPromise, timeoutPromise]);
      await incrementTenantInflightJobs(tenantId);
      return true;
    } finally {
      clearTimeout(timeoutId!);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (error instanceof QueueAddTimeoutError) {
      const landed = await reconcileTimedOutQueueAdd(queue, job.id);
      if (landed) {
        // The add did land after the deadline: keep the inflight counter in sync.
        await incrementTenantInflightJobs(tenantId);
        logger.warn(
          { jobId: job.id, queue: queueName },
          "Job add exceeded deadline but was reconciled as enqueued",
        );
        return true;
      }
    }
    logger.warn({ jobId: job.id, queue: queueName, err: errorMsg }, "Failed to enqueue job");
    return false;
  }
}

/**
 * Gracefully close all BullMQ queue instances.
 */
export async function closeAllQueues(): Promise<void> {
  for (const [name, queue] of queues.entries()) {
    try {
      await queue.close();
      logger.info({ queue: name }, "Queue closed");
    } catch (err) {
      logger.error({ queue: name, err }, "Error closing queue");
    }
  }
  queues.clear();
}

export * from "./queueConfig.js";
export { handleDeadLetterJob } from "./deadLetter.js";
