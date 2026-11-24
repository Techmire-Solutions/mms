import type { BackgroundJobRecord } from "@mms/contracts";
import { startServerBackgroundJob } from "@/lib/backgroundJobs/startServerBackgroundJob";

export async function startServerContactsVcfExport(options: {
  filename: string;
  label: string;
}): Promise<BackgroundJobRecord> {
  return startServerBackgroundJob({
    path: "/api/contacts/export/vcf",
    body: {
      filename: options.filename,
      label: options.label,
    },
  });
}

export async function startContactsDuplicateScan(label?: string): Promise<BackgroundJobRecord> {
  // Each explicit trigger is a NEW scan: a fresh UUID means the backend enqueues a
  // distinct job (the idempotency key is per-trigger, not dedupe-against-previous).
  const idempotencyKey = crypto.randomUUID();
  return startServerBackgroundJob({
    path: "/api/contacts/duplicates/scan",
    body: { label, idempotencyKey },
  });
}
