import type { BackgroundJobRecord, MessagingCsvExportQueryDto } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";
import { upsertLocalBackgroundJob } from "@/lib/backgroundJobs/backgroundJobStore";
import { pollBackgroundJobUntilDone } from "@/lib/backgroundJobs/pollBackgroundJob";

/** Queue a server-side messaging logs CSV export and poll until the job finishes. */
export async function startServerMessagingCsvExport(options: {
  query: MessagingCsvExportQueryDto;
  filename: string;
  label: string;
}): Promise<BackgroundJobRecord> {
  const idempotencyKey = crypto.randomUUID();
  const jobResponse = await apiJson<{ job: BackgroundJobRecord }>("/api/messaging/export/csv", {
    method: "POST",
    body: JSON.stringify({
      query: options.query,
      filename: options.filename,
      label: options.label,
      idempotencyKey,
    }),
  });
  upsertLocalBackgroundJob(jobResponse.job);

  if (jobResponse.job.status === "running" || jobResponse.job.status === "pending") {
    return pollBackgroundJobUntilDone(jobResponse.job.id);
  }
  return jobResponse.job;
}
