import { buildCsvContent } from "@mms/shared";
import {
  completeBackgroundJob,
  failBackgroundJob,
  startBackgroundJob,
} from "@/lib/backgroundJobs/backgroundJobStore";
import { triggerFileDownload } from "@/lib/download";

/** Registers a background job and downloads a CSV (cross-module export helper). */
export function runCsvDownloadJob(options: {
  moduleId: string;
  label: string;
  filename: string;
  rows: unknown[][];
}): void {
  const jobId = startBackgroundJob(options.moduleId, "export", options.label, options.rows.length);
  try {
    const csvContent = buildCsvContent(options.rows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    triggerFileDownload(blob, options.filename);
    completeBackgroundJob(jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    failBackgroundJob(jobId, message);
    throw error;
  }
}
