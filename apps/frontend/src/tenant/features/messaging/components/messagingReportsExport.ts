import type { MessagingCsvExportQueryDto } from "@mms/shared";
import { downloadBackgroundJobArtifact } from "@/lib/backgroundJobs/backgroundJobApi";
import { startServerMessagingCsvExport } from "@/lib/backgroundJobs/startServerMessagingCsvExport";
import { notify } from "@/lib/notify";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

interface ExportMessagingLogsOptions {
  channel: "all" | "sms" | "whatsapp" | "email";
  category: string;
  debouncedSearch: string;
  status: "all" | "sent" | "delivered" | "failed" | "skipped";
  startDate?: string;
  endDate?: string;
  t: TranslationFunction;
}

/** Normalize a date-only picker value for lexicographic sentAt end bound. */
export function messagingExportEndDateBound(dateOnly: string): string {
  const trimmed = dateOnly.trim();
  if (!trimmed) return "";
  if (trimmed.includes("T")) return trimmed;
  return `${trimmed}T23:59:59.999Z`;
}

/** Queue messaging logs CSV on the server, then download the completed artifact. */
export async function exportMessagingLogsFiltered({
  channel,
  category,
  debouncedSearch,
  status,
  startDate,
  endDate,
  t,
}: ExportMessagingLogsOptions): Promise<void> {
  const query: MessagingCsvExportQueryDto = {};
  if (channel !== "all") query.channel = channel;
  if (category !== "all") query.category = category;
  if (debouncedSearch.trim()) query.search = debouncedSearch.trim();
  if (status !== "all") query.status = status;
  if (startDate?.trim()) query.startDate = startDate.trim();
  if (endDate?.trim()) query.endDate = messagingExportEndDateBound(endDate);

  const filename = `${t("messaging.exportFilename")}.csv`;
  const job = await startServerMessagingCsvExport({
    query,
    filename,
    label: t("messaging.jobs.exportLabelServer"),
  });

  if (job.status === "failed") {
    throw new Error(job.error || t("messaging.exportFailed"));
  }

  if (job.hasDownload && job.status === "completed") {
    await downloadBackgroundJobArtifact(job.id, filename);
    notify.success(t("messaging.exportSuccess"));
  }
}
