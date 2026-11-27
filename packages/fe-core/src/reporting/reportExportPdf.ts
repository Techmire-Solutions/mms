import { formatDate, todayISO } from "@mms/contracts";
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
  const { headers: tableHeaders, data: tableData } = extractExportTable(
    columns || sourceColumns,
    rows,
    sourceHeaders,
  );

  // Automatically widen to landscape when many columns would otherwise squeeze/clip in portrait.
  const resolvedOrientation =
    variant === "compact" || (orientation === "p" && tableHeaders.length > 5)
      ? "landscape"
      : orientation;

  const doc = new jsPDF({
    orientation: resolvedOrientation as "p" | "l" | "portrait" | "landscape",
    unit: "mm",
    format: formatSize,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const safeTitle = (title || "Report").trim();
  const wrappedTitle = doc.splitTextToSize(safeTitle, Math.max(pageWidth - 24, 60));

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(wrappedTitle, 12, 14);

  const metaY = 14 + wrappedTitle.length * 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(
    `Generated: ${formatDate(new Date())}  |  ${rows.length} record${rows.length !== 1 ? "s" : ""}`,
    12,
    metaY,
  );
  doc.setTextColor(0);

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData as (string | number)[][],
    startY: metaY + 6,
    margin: { top: 20, left: 10, right: 10, bottom: 14 },
    tableWidth: "auto",
    horizontalPageBreak: true,
    styles: {
      fontSize: tableHeaders.length > 6 ? 7 : 8,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
  });

  const cleanFilename =
    (filename || "report")
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_") || "report";
  doc.save(`${cleanFilename}_${todayISO()}.pdf`);
}
