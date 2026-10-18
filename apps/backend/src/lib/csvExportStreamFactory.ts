import { Readable } from "node:stream";
import { buildCsvContent, isQueryFlagTrue } from "@mms/shared";

export type CsvExportMeta = { count: number; filename: string };

export type CsvExportPageResult<TRow> = {
  rows: TRow[];
  hasMore: boolean;
  nextCursor?: string;
};

export type CsvStreamFactoryOptions<TRow, TCol extends { label: string }> = {
  filename: string;
  chunkSize: number;
  columns: TCol[];
  includeIds?: string[];
  loadByIds: (ids: string[]) => Promise<TRow[]>;
  loadPage: (page: number, limit: number, afterId?: string) => Promise<CsvExportPageResult<TRow>>;
  /** Yield CSV data chunks for one batch (no header). */
  yieldDataChunks: (
    rows: TRow[],
    columns: TCol[],
    chunkSize: number,
  ) => Generator<string, void, undefined>;
};

/** Coerce export query includeDeleted flags; strip when allowDeleted is false. */
export function normalizeIncludeDeletedFlag(
  value: unknown,
  allowDeleted: boolean,
): boolean | undefined {
  if (!allowDeleted) return undefined;
  if (value === undefined || value === null) return undefined;
  return isQueryFlagTrue(value);
}

/**
 * Async generator: CSV header → selection by ids OR SQL page-walk.
 * Module services supply loaders + domain yieldDataChunks.
 */
export async function* generateCsvStreamChunks<TRow, TCol extends { label: string }>(
  options: CsvStreamFactoryOptions<TRow, TCol>,
): AsyncGenerator<string, CsvExportMeta, undefined> {
  const { filename, chunkSize, columns, includeIds, loadByIds, loadPage, yieldDataChunks } =
    options;

  yield buildCsvContent([columns.map((col) => col.label)]);

  const batchSize = Math.min(Math.max(1, chunkSize), 250);

  if (includeIds && includeIds.length > 0) {
    let exported = 0;
    for (let i = 0; i < includeIds.length; i += batchSize) {
      const idChunk = includeIds.slice(i, i + batchSize);
      const rows = await loadByIds(idChunk);
      if (rows.length > 0) {
        yield* yieldDataChunks(rows, columns, batchSize);
        exported += rows.length;
      }
    }
    return { count: exported, filename };
  }

  let page = 1;
  let exported = 0;
  let currentCursor: string | undefined = undefined;
  for (;;) {
    const pageResult = await loadPage(page, batchSize, currentCursor);
    if (pageResult.rows.length > 0) {
      yield* yieldDataChunks(pageResult.rows, columns, batchSize);
      exported += pageResult.rows.length;
    }
    if (!pageResult.hasMore) {
      return { count: exported, filename };
    }
    const lastRow = pageResult.rows[pageResult.rows.length - 1] as { id?: unknown } | undefined;
    currentCursor = pageResult.nextCursor ?? (lastRow?.id ? String(lastRow.id) : undefined);
    page += 1;
  }
}

export function streamCsvExportFromGenerator(
  generator: AsyncGenerator<string, CsvExportMeta, undefined>,
  options?: { highWaterMark?: number },
): Readable {
  return Readable.from(generator, {
    highWaterMark: options?.highWaterMark ?? 16384,
    objectMode: false,
  });
}

/** Thrown when a buffered CSV export would exceed the memory-safe byte cap. */
export class CsvExportLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvExportLimitError";
  }
}

/** Memory-safe cap for buffered (non-streamed) CSV exports. */
export const MODULE_CSV_EXPORT_MAX_BYTES = 50 * 1024 * 1024; // 50MB
/** Memory-safe record cap for buffered (non-streamed) CSV exports. */
export const MODULE_CSV_EXPORT_MAX_RECORDS = 5000;

export async function buildCsvExportFromGenerator(
  generator: AsyncGenerator<string, CsvExportMeta, undefined>,
  fallbackFilename: string,
  maxBytes: number = MODULE_CSV_EXPORT_MAX_BYTES,
  maxRecords: number = MODULE_CSV_EXPORT_MAX_RECORDS,
): Promise<{ csv: string; filename: string; count: number }> {
  const chunks: string[] = [];
  let totalBytes = 0;
  let estimatedRowCount = 0;
  let isHeader = true;
  let step = await generator.next();
  while (!step.done) {
    const chunk = step.value;
    totalBytes += Buffer.byteLength(chunk, "utf8");
    if (totalBytes > maxBytes) {
      throw new CsvExportLimitError(
        `Export exceeds maximum of ${maxBytes} bytes. Use the streaming download instead.`,
      );
    }
    if (isHeader) {
      isHeader = false;
    } else {
      let newlines = 0;
      for (let i = 0; i < chunk.length; i++) {
        if (chunk.charCodeAt(i) === 10) newlines++;
      }
      estimatedRowCount += newlines;
      if (estimatedRowCount > maxRecords) {
        throw new CsvExportLimitError(
          `Export exceeds in-memory cap of ${maxRecords} records (${estimatedRowCount}+ records). Use streaming export or background job export.`,
        );
      }
    }
    chunks.push(chunk);
    step = await generator.next();
  }
  const meta = step.value;
  if (meta && meta.count > maxRecords) {
    throw new CsvExportLimitError(
      `Export exceeds in-memory cap of ${maxRecords} records (${meta.count} records). Use streaming export or background job export.`,
    );
  }
  return {
    csv: chunks.join(""),
    filename: meta?.filename || fallbackFilename,
    count: meta?.count ?? 0,
  };
}
