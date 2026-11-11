import { logger } from "../../lib/logger.js";
import { markJobPermanentlyFailed } from "../../services/backgroundJobWorkerService.js";
import { recordAuditEventSafely } from "../../services/auditTrailService.js";
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

  // Points are evidence: a permanently failed award/import must leave a trace in the audit chain,
  // otherwise the operator sees a failed job with no record of what it was trying to credit.
  if (jobData.moduleId.trim().toLowerCase() === "hasanat") {
    await recordAuditEventSafely({
      workspaceSubdomain: jobData.tenantId,
      tableName: "hasanat_distributions",
      recordId: String(jobData.jobId),
      actionType: "UPDATE",
      realUserId: String(jobData.userId),
      newState: {
        tag: "hasanat.job.dead_letter",
        kind: jobData.kind,
        reason: failedReason,
        label: jobData.label,
      },
    });
  }

  // Exam imports can mutate marks; a permanently failed job must leave an audit trace, not only a
  // row marker, exactly like hasanat award jobs.
  if (jobData.moduleId.trim().toLowerCase() === "examinations") {
    await recordAuditEventSafely({
      workspaceSubdomain: jobData.tenantId,
      tableName: "exams",
      recordId: String(jobData.jobId),
      actionType: "UPDATE",
      realUserId: String(jobData.userId),
      newState: {
        tag: "examinations.job.dead_letter",
        kind: jobData.kind,
        reason: failedReason,
        label: jobData.label,
        reasonCode: "job_dead_letter",
      },
    });
  }

  // Messaging broadcast batches permanently failing in queue must record an audit trail so
  // operators have a definitive record of the unrecoverable dispatch failure.
  if (jobData.moduleId.trim().toLowerCase() === "messaging") {
    await recordAuditEventSafely({
      workspaceSubdomain: jobData.tenantId,
      tableName: "message_logs",
      recordId: String(jobData.jobId),
      actionType: "UPDATE",
      realUserId: String(jobData.userId),
      newState: {
        tag: "messaging.job.dead_letter",
        kind: jobData.kind,
        reason: failedReason,
        label: jobData.label,
        reasonCode: "job_dead_letter",
      },
    });
  }

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
