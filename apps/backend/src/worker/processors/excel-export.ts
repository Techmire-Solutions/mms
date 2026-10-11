import ExcelJS from "exceljs";
import { PassThrough } from "node:stream";
import {
  uploadStreamToStorage,
  resolveTenantExportKey,
  type StorageUploadResult,
} from "../../config/storage.js";

export interface ExcelColumnDefinition {
  header: string;
  key: string;
  width?: number;
}

export interface StreamExcelExportOptions {
  tenantId: string;
  filename: string;
  worksheetName?: string;
  columns: ExcelColumnDefinition[];
  rowGenerator:
    | AsyncGenerator<Record<string, unknown>>
    | AsyncIterable<Record<string, unknown>>
    | Iterable<Record<string, unknown>>;
  onProgress?: (processed: number) => Promise<void> | void;
}

/**
 * Streams large tabular datasets directly to Excel (.xlsx) and uploads to S3/local storage
 * without buffering the entire table in memory.
 */
export async function streamTableToExcel(
  options: StreamExcelExportOptions,
): Promise<StorageUploadResult> {
  const {
    tenantId,
    filename,
    worksheetName = "Sheet1",
    columns,
    rowGenerator,
    onProgress,
  } = options;

  const passThrough = new PassThrough();
  const s3Key = resolveTenantExportKey(
    tenantId,
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );

  // Start the background upload promise listening to the passThrough stream
  const uploadPromise = uploadStreamToStorage(
    tenantId,
    s3Key,
    passThrough,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );

  try {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: passThrough,
      useStyles: true,
      useSharedStrings: true,
    });

    const worksheet = workbook.addWorksheet(worksheetName);
    worksheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width ?? 18,
    }));

    let processedCount = 0;
    for await (const row of rowGenerator as AsyncIterable<Record<string, unknown>>) {
      worksheet.addRow(row).commit();
      processedCount += 1;

      if (onProgress && processedCount % 500 === 0) {
        await onProgress(processedCount);
      }
    }

    worksheet.commit();
    await workbook.commit();
    passThrough.end();

    return await uploadPromise;
  } catch (error) {
    // Ensure the stream and upload settle so no handle leaks on error.
    passThrough.destroy(error instanceof Error ? error : new Error(String(error)));
    await uploadPromise.catch(() => {});
    throw error;
  }
}

/**
 * Helper to stream financial ledger entries to S3/local storage.
 */
export async function streamLedgerToS3(
  tenantId: string,
  filename: string,
  rowGenerator: AsyncGenerator<Record<string, unknown>> | AsyncIterable<Record<string, unknown>>,
): Promise<string> {
  const columns: ExcelColumnDefinition[] = [
    { header: "Date", key: "date", width: 15 },
    { header: "Account", key: "account", width: 25 },
    { header: "Debit", key: "debit", width: 15 },
    { header: "Credit", key: "credit", width: 15 },
    { header: "Balance", key: "balance", width: 15 },
    { header: "Description", key: "description", width: 35 },
  ];

  const result = await streamTableToExcel({
    tenantId,
    filename,
    worksheetName: "Ledger",
    columns,
    rowGenerator,
  });

  return result.key;
}
