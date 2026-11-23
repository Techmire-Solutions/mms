import type { PlatformMessageDto } from "@mms/shared";
import { triggerFileDownload } from "@/lib/download";

const HEADERS = [
  "ID",
  "Channel",
  "Subject",
  "Status",
  "Recipients",
  "Scheduled",
  "Sent",
  "Created",
] as const;

function escapeCell(value: string | number | null | undefined): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/** Client-side CSV export for the platform message log. */
export function exportPlatformMessagesCsv(messages: PlatformMessageDto[]): void {
  if (messages.length === 0) return;
  const rows = messages.map((message) =>
    [
      message.id,
      message.channel,
      message.subject ?? "",
      message.status,
      message.recipientSnapshot.length,
      message.scheduledAt ?? "",
      message.sentAt ?? "",
      message.createdAt,
    ]
      .map(escapeCell)
      .join(","),
  );
  const csvContent = [HEADERS.map(escapeCell).join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerFileDownload(blob, `platform-messages-${new Date().toISOString().slice(0, 10)}.csv`);
}
