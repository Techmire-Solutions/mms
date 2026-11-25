/**
 * Removes a retained BullMQ job so the same job id can be added again.
 *
 * BullMQ dedupes by job id: `queue.add(..., { jobId })` is ignored while a job with that id still
 * exists (completed/failed jobs are retained by `removeOnComplete`/`removeOnFail`). The DLQ replay
 * tool re-uses the DB row id as the queue job id, so without this step a replay within the retention
 * window silently did nothing while the DB row was reset to `pending`.
 *
 * The interface is structural so the behaviour is unit-testable without a live queue.
 */
export interface RetainedJobHandle {
  remove(): Promise<void>;
}

export interface RetainedJobQueue {
  getJob(jobId: string): Promise<RetainedJobHandle | null | undefined>;
}

/** Returns true when a retained job was found and removed. */
export async function removeRetainedJob(queue: RetainedJobQueue, jobId: string): Promise<boolean> {
  const existing = await queue.getJob(jobId);
  if (!existing) return false;
  await existing.remove();
  return true;
}
