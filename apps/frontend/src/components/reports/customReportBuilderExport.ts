import type { ExportColumn } from "@/lib/reports/reportExportCore";

/**
 * Export columns for the custom report builder. Preview rows are keyed by the
 * resolved field label (see `buildFlatPreviewRows`), so every export format must
 * read cells by that label, in the on-screen column order.
 */
export function buildCustomReportExportColumns(
  selectedFields: readonly string[],
  resolveFieldLabel: (field: string) => string,
): ExportColumn[] {
  const labels = new Set(selectedFields.map(resolveFieldLabel));
  return Array.from(labels, (label) => ({ header: label, key: label }));
}
