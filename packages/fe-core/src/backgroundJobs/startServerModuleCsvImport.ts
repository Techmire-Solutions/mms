import type { BackgroundJobRecord } from "@mms/contracts";
import { startServerBackgroundJob } from "./startServerBackgroundJob";

/**
 * Queue a server-side module CSV import and poll until the job finishes.
 */
export async function startServerModuleCsvImport(options: {
  path: string;
  body: {
    rows: unknown[];
    label?: string;
    idempotencyKey?: string;
  };
  onProgress?: (job: BackgroundJobRecord) => void;
}): Promise<BackgroundJobRecord> {
  return startServerBackgroundJob({
    path: options.path,
    body: options.body,
    onProgress: options.onProgress,
  });
}
