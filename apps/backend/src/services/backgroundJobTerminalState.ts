import { publishJobEvent } from "../worker/pubsub/jobPubSub.js";
import { patchJob } from "./backgroundJobPatch.js";

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
