import { formatDateTime, formatNumber } from "@mms/shared";
import type { AggregatedItem, ChartOperation } from "./dynamicChartVisualizerTypes";
import { getPdfPageDimensions } from "./dynamicChartVisualizerHelpers";
import { exportReportExcel, sanitizeExportValue } from "@/lib/reports/reportExportCore";

function slugifyTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, "-");
}

export async function exportVisualizerPng(options: {
  chartElement: HTMLElement;
  title: string;
}): Promise<void> {
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(options.chartElement, {
    backgroundColor: "rgba(255, 255, 255, 1)",
    scale: 2,
    logging: false,
  });
  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.download = `${slugifyTitle(options.title)}-chart.png`;
  link.href = dataUrl;
  link.click();
}

export async function exportVisualizerExcel(options: {
  title: string;
  processedData: AggregatedItem[];
}): Promise<void> {
  if (options.processedData.length === 0) return;
  const sheetData = options.processedData.map((aggregatedItem) => ({
    "Grouping Key": sanitizeExportValue(aggregatedItem.name),
    "Aggregated Value": sanitizeExportValue(aggregatedItem.value),
    Count: sanitizeExportValue(aggregatedItem.count),
  }));
  await exportReportExcel({
    title: options.title,
    rows: sheetData as Record<string, unknown>[],
    filename: options.title,
  });
}

export async function exportVisualizerPdf(options: {
  chartElement: HTMLElement;
  title: string;
  processedData: AggregatedItem[];
  operation: ChartOperation;
  xAxisField: string;
  collectionLabel: string;
  pdfFormat: string;
  pdfOrientation: "p" | "l";
}): Promise<void> {
  const [html2canvasModule, jsPDFModule, autoTableModule] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const html2canvas = html2canvasModule.default;
  const jsPDF = jsPDFModule.default;
  const autoTable = autoTableModule.default;

  const canvas = await html2canvas(options.chartElement, {
    backgroundColor: "rgba(255, 255, 255, 1)",
    scale: 2,
    logging: false,
  });
  const dataUrl = canvas.toDataURL("image/png");
  const { formatWidth } = getPdfPageDimensions(options.pdfFormat, options.pdfOrientation);

  const doc = new jsPDF({
    orientation: options.pdfOrientation,
    unit: "mm",
    format: options.pdfFormat,
  });

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(18);
  doc.text("MMS - Analytics Report", 14, 20);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${formatDateTime(new Date())}`, 14, 26);
  doc.text(
    `Subject Dataset: ${options.collectionLabel} (${options.operation.toUpperCase()} of ${options.xAxisField})`,
    14,
    31,
  );

  doc.line(14, 34, formatWidth - 14, 34);

  const margin = 14;
  const printableWidth = formatWidth - margin * 2;
  const chartWidth = printableWidth;
  const chartHeight = (canvas.height / canvas.width) * chartWidth;

  doc.addImage(dataUrl, "PNG", margin, 38, chartWidth, chartHeight);

  autoTable(doc, {
    head: [
      [
        "Grouping Key (X-Axis)",
        `Aggregated Value (${options.operation.toUpperCase()})`,
        "Record Count",
      ],
    ],
    body: options.processedData.map((row) => [
      sanitizeExportValue(row.name),
      sanitizeExportValue(formatNumber(row.value)),
      sanitizeExportValue(row.count),
    ]),
    startY: chartHeight + 48,
    styles: { fontSize: options.pdfOrientation === "l" ? 9 : 10 },
    headStyles: { fillColor: [16, 185, 129] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`${slugifyTitle(options.title)}-report.pdf`);
}
