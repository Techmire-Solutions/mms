import { logger } from "../../lib/logger.js";
import { markJobPermanentlyFailed } from "../../services/backgroundJobWorkerService.js";
import { failPromotionRunFromDlq } from "../../services/sessionRolloverFinalizer.js";
import type { EnqueuedJobData } from "./index.js";

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

  if (
    jobData.moduleId.trim().toLowerCase() === "sessions" &&
    jobData.kind.trim().toLowerCase() === "promote"
  ) {
    await failPromotionRunFromDlq(
      jobData.tenantId,
      jobData.jobId,
      `Job failed permanently in queue: ${failedReason}`,
    ).catch((err) => {
      logger.error(
        { jobId: jobData.jobId, err },
        "Failed to reconcile the rollover run after dead-lettering",
      );
    });
  }
}
