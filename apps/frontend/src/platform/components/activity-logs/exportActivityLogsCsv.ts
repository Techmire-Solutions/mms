import { triggerFileDownload } from "@/lib/download";
import type { PlatformActivityLogItem } from "@/platform/hooks/usePlatformActivityLogs";

export function exportActivityLogsCsv(items: PlatformActivityLogItem[]): void {
  if (items.length === 0) return;
  const headers = [
    "ID",
    "Date",
    "Action",
    "User Email",
    "Target Resource",
    "Target ID",
    "IP Address",
    "Metadata",
  ];
  const rows = items.map((log) => [
    log.id,
    log.createdAt,
    log.action,
    log.userEmail,
    log.targetResource ?? "",
    log.targetId ?? "",
    log.ipAddress ?? "",
    (log.metadataMessage ?? "").replace(/"/g, '""'),
  ]);
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerFileDownload(blob, `platform-activity-logs-${new Date().toISOString().slice(0, 10)}.csv`);
}
