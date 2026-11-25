import type { BackgroundJobRecord, MessagingCsvExportQueryDto } from "@mms/contracts";
import { apiJson } from "../api/client.js";
import { upsertLocalBackgroundJob } from "../backgroundJobs/index.js";
import { pollBackgroundJobUntilDone } from "../backgroundJobs/index.js";

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
