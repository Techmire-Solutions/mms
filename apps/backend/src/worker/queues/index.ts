import { Queue } from "bullmq";
import type { BackgroundJobRecord } from "@mms/shared";
import {
  QUEUE_PDF_RENDERING,
  QUEUE_BULK_EXPORT,
  QUEUE_MESSAGING_BROADCAST,
  QUEUE_SETTINGS,
  DEFAULT_JOB_OPTIONS,
  TENANT_PRIORITY_BANDS,
  getBullMQConnectionOptions,
} from "./queueConfig.js";
import { markJobPermanentlyFailed } from "../../services/backgroundJobWorkerService.js";
import { stripUndefinedFields } from "../../lib/payloadTrimmer.js";
import { logger } from "../../lib/logger.js";
import { redisGet, redisIncr, redisDecr } from "../../lib/redis.js";

export const MAX_JOB_PAYLOAD_BYTES = 1024 * 1024; // 1 MB payload ceiling

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

/**
 * Inflight jobs tracking per tenant for fair-share background scheduling.
 */
export async function getTenantInflightJobsCount(tenantId: string): Promise<number> {
  const normTenant = tenantId.trim().toLowerCase();
  const key = `mms:tenant:${normTenant}:inflight_jobs`;
  const val = await redisGet(key);
  return val ? Number.parseInt(val, 10) || 0 : 0;
}

export async function incrementTenantInflightJobs(tenantId: string): Promise<number> {
  const normTenant = tenantId.trim().toLowerCase();
  const key = `mms:tenant:${normTenant}:inflight_jobs`;
  return redisIncr(key, 3600);
}

export async function decrementTenantInflightJobs(tenantId: string): Promise<number> {
  const normTenant = tenantId.trim().toLowerCase();
  const key = `mms:tenant:${normTenant}:inflight_jobs`;
  return redisDecr(key, 3600);
}

/**
 * Calculates fair-share priority band for a tenant based on current inflight load.
 * Lower numerical priority value in BullMQ means higher execution precedence (1 = highest).
 */
export async function calculateTenantFairSharePriority(
  tenantId: string,
  basePriority = 2,
): Promise<number> {
  const inflight = await getTenantInflightJobsCount(tenantId);
  if (inflight <= 1) {
    return Math.min(basePriority, TENANT_PRIORITY_BANDS.BAND_1_LOW_LOAD);
  }
  if (inflight <= 5) {
    return Math.max(basePriority, TENANT_PRIORITY_BANDS.BAND_2_NORMAL_LOAD);
  }
  return TENANT_PRIORITY_BANDS.BAND_3_HIGH_LOAD;
}

/**
 * Dispatches a background job to the appropriate BullMQ queue with tenant fair-share scheduling.
 * Returns true if enqueued to BullMQ, false if Redis is unavailable and should fallback.
 */
export async function dispatchJobToQueue(
  tenantId: string,
  userId: string,
  job: BackgroundJobRecord,
  payload: unknown,
): Promise<boolean> {
  const queueName = resolveQueueNameForJob(job.moduleId, job.kind);
  const queue = getQueue(queueName);

  const sanitizedPayload = stripUndefinedFields(payload);
  if (sanitizedPayload !== undefined && sanitizedPayload !== null) {
    try {
      const payloadSize = Buffer.byteLength(JSON.stringify(sanitizedPayload), "utf8");
      if (payloadSize > MAX_JOB_PAYLOAD_BYTES) {
        logger.warn(
          { jobId: job.id, queue: queueName, payloadSize, max: MAX_JOB_PAYLOAD_BYTES },
          "Job payload exceeds 1MB limit; consider offloading to external storage artifact",
        );
      }
    } catch {
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
    const addPromise = queue.add(`${job.moduleId}:${job.kind}`, jobData, {
      jobId: job.id,
      priority: fairSharePriority,
    });
    // Guard against unhandled rejections if timeoutPromise wins the race
    addPromise.catch(() => {});

    // Fail fast if Redis is unreachable to prevent API request hanging
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("BullMQ queue.add timeout (Redis unreachable)")),
        6000,
      );
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
    logger.warn({ jobId: job.id, queue: queueName, err: errorMsg }, "Failed to enqueue job");
    return false;
  }
}

/**
 * Record a Dead-Letter Queue (DLQ) event when a job exhausts all retries.
 */
export async function handleDeadLetterJob(
  queueName: string,
  jobData: EnqueuedJobData,
  failedReason: string,
): Promise<void> {
  logger.error(
    {
      jobId: jobData.jobId,
      moduleId: jobData.moduleId,
      kind: jobData.kind,
      queue: queueName,
      reason: failedReason,
    },
    "Job permanently failed in queue",
  );

  await markJobPermanentlyFailed(
    jobData.tenantId,
    jobData.userId,
    jobData.jobId,
    jobData.moduleId,
    jobData.kind,
    `Job failed permanently in queue: ${failedReason}`,
  ).catch((err) => {
    logger.error({ jobId: jobData.jobId, err }, "Failed to record dead-letter job in DB");
  });
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
