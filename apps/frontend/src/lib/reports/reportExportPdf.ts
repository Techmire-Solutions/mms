import { formatDate, todayISO } from "@mms/shared";
import { extractExportTable, type ExportColumn } from "./reportExportCore";

export interface PdfExportOptions {
  title: string;
  columns?: ExportColumn[];
  rows: Record<string, unknown>[];
  filename: string;
  orientation?: "p" | "l" | "portrait" | "landscape";
  formatSize?: string;
  variant?: "default" | "compact";
  sourceColumns?: ExportColumn[];
  sourceHeaders?: string[];
}

/**
 * Exports data to a formatted PDF document using jsPDF and autoTable.
 */
export async function exportReportPdf({
  title,
  columns,
  rows,
  filename,
  orientation = "p",
  formatSize = "a4",
  variant = "default",
  sourceColumns,
  sourceHeaders,
}: PdfExportOptions): Promise<void> {
  if (rows.length === 0) return;

  const [jsPDFModule, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const jsPDF = jsPDFModule.default;
  const autoTable = autoTableModule.default;
  const resolvedOrientation = variant === "compact" ? "landscape" : orientation;

  const doc = new jsPDF({
    orientation: resolvedOrientation as "p" | "l" | "portrait" | "landscape",
    unit: "mm",
    format: formatSize,
  });

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 14);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(
    `Generated: ${formatDate(new Date())}  |  ${rows.length} record${rows.length !== 1 ? "s" : ""}`,
    14,
    20,
  );
  doc.setTextColor(0);

  const { headers: tableHeaders, data: tableData } = extractExportTable(
    columns || sourceColumns,
    rows,
    sourceHeaders,
  );

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData as (string | number)[][],
    startY: 26,
    styles: {
      fontSize: resolvedOrientation === "l" || resolvedOrientation === "landscape" ? 8 : 10,
    },
  });

  doc.save(`${filename}_${todayISO()}.pdf`);
}
