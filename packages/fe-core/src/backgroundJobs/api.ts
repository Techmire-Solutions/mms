import { BACKGROUND_JOBS_API_PATH, type BackgroundJobRecord } from "@mms/contracts";
import { apiFetch, apiJson } from "../api/client";
import { triggerFileDownload } from "../api/download";

export async function fetchBackgroundJobs(signal?: AbortSignal): Promise<BackgroundJobRecord[]> {
  const jobsResponse = await apiJson<{ jobs: BackgroundJobRecord[] }>(BACKGROUND_JOBS_API_PATH, {
    priority: "low",
    signal,
  });
  return jobsResponse?.jobs ?? [];
}

export async function upsertBackgroundJobRemote(
  job: BackgroundJobRecord,
): Promise<BackgroundJobRecord> {
  const jobResponse = await apiJson<{ job: BackgroundJobRecord }>(
    `${BACKGROUND_JOBS_API_PATH}/${job.id}`,
    {
      method: "PUT",
      body: JSON.stringify(job),
    },
  );
  return jobResponse.job;
}

export async function dismissBackgroundJobRemote(jobId: string): Promise<void> {
  await apiFetch(`${BACKGROUND_JOBS_API_PATH}/${jobId}`, { method: "DELETE" });
}

export async function clearFinishedBackgroundJobsRemote(): Promise<void> {
  await apiJson<{ success: boolean }>(`${BACKGROUND_JOBS_API_PATH}/clear-finished`, {
    method: "POST",
    priority: "low",
  });
}

function parseFilenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename="([^"]+)"/i.exec(header);
  return match?.[1] ?? fallback;
}

/** Downloads a server-generated export artifact for a completed background job. */
export async function downloadBackgroundJobArtifact(
  jobId: string,
  fallbackFilename = "export.csv",
): Promise<void> {
  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await apiFetch(`${BACKGROUND_JOBS_API_PATH}/${jobId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const filename = parseFilenameFromDisposition(
          response.headers.get("Content-Disposition"),
          fallbackFilename,
        );
        triggerFileDownload(blob, filename);
        return;
      }

      if (response.status === 404 && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 400));
        continue;
      }

      const errorText = await response.text().catch(() => "");
      let parsedMessage: string | undefined;
      try {
        const json = JSON.parse(errorText) as { message?: string };
        parsedMessage = json.message;
      } catch {
        /* not JSON */
      }
      throw new Error(parsedMessage || errorText || "Download failed");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 400));
      }
    }
  }

  throw lastError ?? new Error("Download failed");
}
