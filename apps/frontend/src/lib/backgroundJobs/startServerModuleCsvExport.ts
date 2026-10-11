import type { BackgroundJobRecord } from "@mms/shared";
import { startServerBackgroundJob } from "@/lib/backgroundJobs/startServerBackgroundJob";

/**
 * Queue a server-side module CSV export and poll until the job finishes.
 */
export async function startServerModuleCsvExport(options: {
  path: string;
  body: Record<string, unknown>;
}): Promise<BackgroundJobRecord> {
  return startServerBackgroundJob(options);
}
