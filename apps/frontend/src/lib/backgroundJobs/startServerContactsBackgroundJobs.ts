import type { BackgroundJobRecord } from "@mms/shared";
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
  return startServerBackgroundJob({
    path: "/api/contacts/duplicates/scan",
    body: { label },
  });
}
