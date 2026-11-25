import type { ConsolidationReport } from "@mms/contracts";
import { triggerFileDownload } from "@mms/fe-core/api/download";

const HEADERS = ["Code", "Name", "Type", "Combined", "Elimination", "Balance"] as const;

function escapeCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/** Client-side CSV export of the consolidated trial balance. */
export function exportConsolidationReportCsv(report: ConsolidationReport): void {
  const rows = report.consolidated.rows.map((row) =>
    [row.code, row.name, row.type, row.combined, row.elimination, row.balance]
      .map(escapeCell)
      .join(","),
  );
  const csvContent = [HEADERS.map(escapeCell).join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerFileDownload(
    blob,
    `consolidation-${report.group.name}-${report.dateFrom}-${report.dateTo}.csv`,
  );
}
