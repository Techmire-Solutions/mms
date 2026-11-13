import { todayISO, buildCsvContent } from "@mms/shared";
import { runGridCsvExportJob } from "@/lib/backgroundJobs/runGridCsvExportJob";
import { triggerFileDownload } from "@/lib/download";
import { exportReportPdf, type PdfExportOptions } from "./reportExportPdf";

export type { PdfExportOptions };
export { exportReportPdf };

export interface ExportColumn {
  header: string;
  key: string;
}

export type ExportCell = string | number | boolean;

export interface ExportTable {
  headers: string[];
  data: ExportCell[][];
  mappedObjects: Record<string, unknown>[];
}

export interface ExcelExportOptions {
  title: string;
  columns?: ExportColumn[];
  rows: Record<string, unknown>[];
  filename: string;
  moduleId?: string;
  exportLabel?: string;
  sourceColumns?: ExportColumn[];
  sourceHeaders?: string[];
}

// Mirrors @mms/shared `escapeCsvCell`: OWASP triggers plus the whitespace-hidden
// form, while a plain negative numeric string (-100.5) stays a number.
const FORMULA_PREFIX_REGEX = /^[=+\-@|%\t\r]/;
const WHITESPACE_FORMULA_PREFIX = /^\s+[=+\-@|%]/;
const NEGATIVE_NUMERIC_STRING = /^-(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Escapes potentially unsafe formula-injection characters for CSV/Excel cells.
 *
 * A leading `'` neutralises the formula; plain negative amounts are left numeric
 * (prefixing them turned a -100.00 amount into a text cell in Excel).
 */
export function sanitizeExportValue(value: unknown): ExportCell {
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;

  const str = String(value);
  const looksLikeFormula = FORMULA_PREFIX_REGEX.test(str) || WHITESPACE_FORMULA_PREFIX.test(str);
  if (looksLikeFormula && !NEGATIVE_NUMERIC_STRING.test(str.trim())) {
    return `'${str}`;
  }
  return str;
}

/**
 * Normalizes tabular row/column records into headers, rows, and mapped objects.
 */
export function extractExportTable(
  columns?: ExportColumn[],
  rows: Record<string, unknown>[] = [],
  headers?: string[],
): ExportTable {
  const rowCount = rows.length;

  if (columns && columns.length > 0) {
    const colCount = columns.length;
    const tableHeaders = new Array<string>(colCount);
    for (let j = 0; j < colCount; j++) {
      tableHeaders[j] = columns[j].header;
    }

    const tableData = new Array<ExportCell[]>(rowCount);
    const mappedObjects = new Array<Record<string, unknown>>(rowCount);

    for (let i = 0; i < rowCount; i++) {
      const row = rows[i];
      const dataRow = new Array<ExportCell>(colCount);
      const obj: Record<string, unknown> = {};

      for (let j = 0; j < colCount; j++) {
        const col = columns[j];
        const val = sanitizeExportValue(row[col.key]);
        dataRow[j] = val;
        obj[col.header] = val;
      }

      tableData[i] = dataRow;
      mappedObjects[i] = obj;
    }

    return { headers: tableHeaders, data: tableData, mappedObjects };
  }

  const tableHeaders = headers || (rowCount > 0 ? Object.keys(rows[0]) : []);
  const headerCount = tableHeaders.length;
  const tableData = new Array<ExportCell[]>(rowCount);
  const mappedObjects = new Array<Record<string, unknown>>(rowCount);

  for (let i = 0; i < rowCount; i++) {
    const row = rows[i];
    const dataRow = new Array<ExportCell>(headerCount);
    const obj: Record<string, unknown> = {};

    for (let j = 0; j < headerCount; j++) {
      const header = tableHeaders[j];
      const val = sanitizeExportValue(row[header]);
      dataRow[j] = val;
      obj[header] = val;
    }

    tableData[i] = dataRow;
    mappedObjects[i] = obj;
  }

  return { headers: tableHeaders, data: tableData, mappedObjects };
}

/**
 * Fallback to direct CSV file download if xlsx library is unavailable.
 */
export function downloadExcelFallback(
  columns: ExportColumn[] | undefined,
  rows: Record<string, unknown>[],
  filename: string,
  headers?: string[],
): void {
  const { headers: tableHeaders, data } = extractExportTable(columns, rows, headers);
  const csv = buildCsvContent([tableHeaders, ...data]);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerFileDownload(blob, `${filename}.csv`);
}

/**
 * Exports data to Excel workbook (.xlsx) or triggers a background CSV export job if moduleId is specified.
 */
export async function exportReportExcel({
  title,
  columns,
  rows,
  filename,
  moduleId,
  exportLabel,
  sourceColumns,
  sourceHeaders,
}: ExcelExportOptions): Promise<void> {
  if (rows.length === 0) return;

  const resolvedCols = columns || sourceColumns || [];

  if (moduleId) {
    runGridCsvExportJob({
      moduleId,
      label: exportLabel || title,
      filename,
      columns:
        resolvedCols.length > 0
          ? resolvedCols
          : (sourceHeaders || Object.keys(rows[0] || {})).map((h) => ({ header: h, key: h })),
      rows,
    });
    return;
  }

  try {
    const XLSX = await import("xlsx");
    const { mappedObjects } = extractExportTable(columns || sourceColumns, rows, sourceHeaders);
    const worksheet = XLSX.utils.json_to_sheet(mappedObjects);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `${filename}_${todayISO()}.xlsx`);
  } catch {
    downloadExcelFallback(columns || sourceColumns, rows, filename, sourceHeaders);
  }
}
