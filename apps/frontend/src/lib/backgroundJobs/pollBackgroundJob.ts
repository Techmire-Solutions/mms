import type { BackgroundJobRecord } from "@mms/shared";
import { BACKGROUND_JOBS_API_PATH } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";
import { upsertLocalBackgroundJob } from "@/lib/backgroundJobs/backgroundJobStore";

const POLL_INTERVAL_MS = 1_500;
const DEFAULT_TIMEOUT_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll budget exhausted while the job was still `pending`/`running`.
 *
 * Distinct from a job that actually failed: callers must not report a timeout as an
 * export failure — the worker keeps going and the artifact still reaches the jobs tray.
 */
export class BackgroundJobTimeoutError extends Error {
  constructor(message = "Background job timed out") {
    super(message);
    this.name = "BackgroundJobTimeoutError";
  }
}

export async function fetchBackgroundJob(jobId: string): Promise<BackgroundJobRecord | null> {
  try {
    const jobResponse = await apiJson<{ job: BackgroundJobRecord }>(
      `${BACKGROUND_JOBS_API_PATH}/${jobId}`,
    );
    return jobResponse.job;
  } catch {
    return null;
  }
}

/**
 * Polls until a background job completes, fails, or times out.
 *
 * @throws {Error} when the job itself failed (message = worker error).
 * @throws {BackgroundJobTimeoutError} when the poll budget elapsed first — the job may still finish.
 */
export async function pollBackgroundJobUntilDone(
  jobId: string,
  options?: { timeoutMs?: number; onUpdate?: (job: BackgroundJobRecord) => void },
): Promise<BackgroundJobRecord> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const job = await fetchBackgroundJob(jobId);
    if (job) {
      upsertLocalBackgroundJob(job);
      options?.onUpdate?.(job);
      if (job.status === "completed") return job;
      if (job.status === "failed") {
        throw new Error(job.error ?? "Background job failed");
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new BackgroundJobTimeoutError();
}
