import { isSystemMetadataKey } from "@mms/shared";
import { runCsvDownloadJob } from "@/lib/backgroundJobs/runCsvDownloadJob";

export interface GridExportColumn {
  header: string;
  key: string;
}

/** Registers a background job and downloads a grid-shaped dataset as CSV. */
export function runGridCsvExportJob(options: {
  moduleId: string;
  label: string;
  filename: string;
  columns: GridExportColumn[];
  rows: Record<string, unknown>[];
}): void {
  const safeColumns = options.columns.filter(
    (c) => !isSystemMetadataKey(c.key) && !isSystemMetadataKey(c.header),
  );
  const colCount = safeColumns.length;
  const header = new Array<string>(colCount);
  const keys = new Array<string>(colCount);
  for (let j = 0; j < colCount; j++) {
    header[j] = safeColumns[j].header;
    keys[j] = safeColumns[j].key;
  }

  const rowCount = options.rows.length;
  const csvRows = new Array<unknown[]>(rowCount);
  for (let i = 0; i < rowCount; i++) {
    const row = options.rows[i];
    const rowCells = new Array<unknown>(colCount);
    for (let j = 0; j < colCount; j++) {
      rowCells[j] = row[keys[j]] ?? "";
    }
    csvRows[i] = rowCells;
  }

  runCsvDownloadJob({
    moduleId: options.moduleId,
    label: options.label,
    filename: options.filename.endsWith(".csv") ? options.filename : `${options.filename}.csv`,
    rows: [header, ...csvRows],
  });
}
