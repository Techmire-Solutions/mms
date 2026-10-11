import {
  exportReportExcel,
  exportReportPdf,
  downloadExcelFallback,
  extractExportTable,
  sanitizeExportValue,
  type ExportColumn,
  type ExportCell,
  type ExportTable,
  type ExcelExportOptions,
  type PdfExportOptions,
} from "@/lib/reports/reportExportCore";

export type { ExportColumn, ExportCell, ExportTable, ExcelExportOptions, PdfExportOptions };

export { extractExportTable, downloadExcelFallback, sanitizeExportValue };

export const exportExcel = exportReportExcel;
export const exportPdf = exportReportPdf;
