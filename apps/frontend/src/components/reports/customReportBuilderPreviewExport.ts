import type { PreviewRow } from "./customReportBuilderFields";

export async function exportCustomReportExcel(
  previewData: PreviewRow[],
  reportName: string,
): Promise<void> {
  if (previewData.length === 0) return;
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(previewData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Custom Report");
  XLSX.writeFile(workbook, `${reportName.replace(/\s+/g, "_")}.xlsx`);
}

export async function exportCustomReportPdf(
  previewData: PreviewRow[],
  selectedFields: string[],
  reportName: string,
  orientation: "p" | "l",
  pageSize: string,
): Promise<void> {
  if (previewData.length === 0) return;
  const [jsPDFModule, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const jsPDF = jsPDFModule.default;
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: pageSize,
  });
  doc.text(reportName, 14, 15);
  const tableData = previewData.map((previewRow) =>
    selectedFields.map((selectedField) => previewRow[selectedField]),
  );
  autoTable(doc, {
    head: [selectedFields],
    body: tableData as string[][],
    startY: 20,
    styles: { fontSize: orientation === "l" ? 8 : 10 },
  });
  doc.save(`${reportName.replace(/\s+/g, "_")}.pdf`);
}
