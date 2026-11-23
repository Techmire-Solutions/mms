import type { PlatformContactDto } from "@mms/shared";
import { triggerFileDownload } from "@/lib/download";

const HEADERS = ["ID", "Name", "Email", "Phone", "Kind", "Workspace", "Tags", "Notes"] as const;

function escapeCell(value: string | number | null | undefined): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/** Client-side CSV export for the platform contact directory (matches the platform export pattern). */
export function exportPlatformContactsCsv(contacts: PlatformContactDto[]): void {
  if (contacts.length === 0) return;
  const rows = contacts.map((contact) =>
    [
      contact.id,
      contact.name,
      contact.email ?? "",
      contact.phone ?? "",
      contact.kind,
      contact.workspaceId ?? "",
      (contact.tags ?? []).map((tag) => tag.label).join("; "),
      contact.notes ?? "",
    ]
      .map(escapeCell)
      .join(","),
  );
  const csvContent = [HEADERS.map(escapeCell).join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerFileDownload(blob, `platform-contacts-${new Date().toISOString().slice(0, 10)}.csv`);
}
