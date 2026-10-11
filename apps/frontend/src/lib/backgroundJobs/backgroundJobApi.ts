import { BACKGROUND_JOBS_API_PATH, type BackgroundJobRecord } from "@mms/shared";
import { apiFetch, apiJson } from "@/lib/apiClient";
import { triggerFileDownload } from "@/lib/download";

export async function fetchBackgroundJobs(): Promise<BackgroundJobRecord[]> {
  const jobsResponse = await apiJson<{ jobs: BackgroundJobRecord[] }>(BACKGROUND_JOBS_API_PATH);
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
  const response = await apiFetch(`${BACKGROUND_JOBS_API_PATH}/${jobId}/download`);
  if (!response.ok) {
    throw new Error("Download failed");
  }
  const blob = await response.blob();
  const filename = parseFilenameFromDisposition(
    response.headers.get("Content-Disposition"),
    fallbackFilename,
  );
  triggerFileDownload(blob, filename);
}
