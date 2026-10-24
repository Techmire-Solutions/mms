import type { BackgroundJobRecord } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";
import { upsertLocalBackgroundJob } from "@/lib/backgroundJobs/backgroundJobStore";
import { pollBackgroundJobUntilDone } from "@/lib/backgroundJobs/pollBackgroundJob";

/**
 * POST a background job endpoint, upsert locally, and poll while pending/running.
 *
 * `onProgress` receives each polled job state, so long-running callers can show live
 * progress instead of an opaque spinner.
 */
export async function startServerBackgroundJob(options: {
  path: string;
  body?: Record<string, unknown>;
  onProgress?: (job: BackgroundJobRecord) => void;
}): Promise<BackgroundJobRecord> {
  const jobResponse = await apiJson<{ job: BackgroundJobRecord }>(options.path, {
    method: "POST",
    body: JSON.stringify(options.body ?? {}),
  });
  upsertLocalBackgroundJob(jobResponse.job);

  if (jobResponse.job.status === "running" || jobResponse.job.status === "pending") {
    return pollBackgroundJobUntilDone(jobResponse.job.id, {
      onUpdate: options.onProgress,
    });
  }
  return jobResponse.job;
}
