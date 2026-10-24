import type { PlatformUserProfile } from "@mms/shared";
import { triggerFileDownload } from "@/lib/download";
import type { usePlatformUserDescriptor } from "@/platform/hooks/usePlatformUserDescriptor";

export function exportPlatformAdminsCsv(
  admins: PlatformUserProfile[],
  descriptor: ReturnType<typeof usePlatformUserDescriptor>,
): void {
  if (admins.length === 0) return;
  const columns = descriptor.getTableColumns();
  const headers = ["ID", ...columns.map((c) => c.label)];
  const rows = admins.map((admin) => [
    admin.id,
    ...columns.map((col) => descriptor.formatFieldValue(col.id, admin)),
  ]);
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerFileDownload(blob, `platform-admins-${new Date().toISOString().slice(0, 10)}.csv`);
}
