import type { Job } from "bullmq";
import type { EnqueuedJobData } from "../queues/index.js";
import { executeJob } from "../../services/backgroundJobWorkerService.js";
import { tracer } from "../../config/telemetry.js";
import { logger } from "../../lib/logger.js";

import { WORKER_HEAP_LIMIT_BYTES } from "../queues/queueConfig.js";

export async function processBackgroundJob(job: Job<EnqueuedJobData>): Promise<void> {
  const { tenantId, userId, jobId, moduleId, kind, payload } = job.data;

  // Process-level memory ceiling check
  const mem = process.memoryUsage();
  if (mem.heapUsed > WORKER_HEAP_LIMIT_BYTES) {
    logger.warn(
      {
        jobId,
        queue: job.queueName,
        heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
        limitMb: Math.round(WORKER_HEAP_LIMIT_BYTES / (1024 * 1024)),
      },
      "BullMQ worker heap usage approaching ceiling, running garbage collection if available",
    );
    if (typeof globalThis.gc === "function") {
      globalThis.gc();
    }
    const memAfter = process.memoryUsage();
    if (memAfter.heapUsed > WORKER_HEAP_LIMIT_BYTES) {
      logger.warn(
        {
          jobId,
          queue: job.queueName,
          heapUsedMb: Math.round(memAfter.heapUsed / (1024 * 1024)),
        },
        "Worker heap remains above threshold after GC; applying backpressure delay",
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  logger.info(
    { jobId, moduleId, kind, queue: job.queueName, attempt: job.attemptsMade + 1 },
    "Processing job",
  );

  await tracer.withSpan(
    `bullmq.job ${moduleId}:${kind}`,
    {
      "messaging.system": "bullmq",
      "messaging.destination": job.queueName,
      "job.id": jobId,
      "tenant.id": tenantId,
      "user.id": userId,
      "job.module_id": moduleId,
      "job.kind": kind,
      "job.attempt": job.attemptsMade + 1,
    },
    async () => {
      await executeJob(tenantId, userId, jobId, moduleId, kind, payload);
    },
  );
}
