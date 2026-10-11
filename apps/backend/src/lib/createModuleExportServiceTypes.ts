/**
 * @file createModuleExportServiceTypes.ts
 * @description Types for the generic module export service factory.
 */
import type { ExportFormat, ExportColumn } from "@mms/shared";
import { isSystemMetadataKey } from "@mms/shared";

export type ModuleCsvExportColumn = { id?: string; label: string };

export type ModuleCsvExportManifestBits = {
  defaultExportFilename: string;
  exportChunkSize: number;
};

export type ModuleExportQueryInput<TQuery> = Omit<TQuery, "includeDeleted"> & {
  includeDeleted?: boolean | "true" | "false" | string;
  includeIds?: Array<string | number>;
};

export type ModuleExportOptions<TCol extends ModuleCsvExportColumn = ModuleCsvExportColumn> = {
  columns?: TCol[];
  filename?: string;
  viewerRole: string;
  chunkSize?: number;
  allowDeleted?: boolean;
  /** Output format — defaults to `'csv'`. Non-CSV formats are buffered. */
  format?: ExportFormat;
};

export type ModuleExportResult = {
  /** Serialized content — CSV/JSON string, or Base64-encoded XLSX. */
  content: string;
  /** Present for backward compatibility with CSV tests / callers. */
  csv: string;
  filename: string;
  count: number;
  format: ExportFormat;
  contentType: string;
};

export type CreateModuleExportServiceOptions<
  TRow,
  TQuery,
  TCol extends ModuleCsvExportColumn,
  TContext = undefined,
> = {
  manifest: ModuleCsvExportManifestBits;
  normalizeQuery: (
    query: TQuery,
    allowDeleted: boolean,
  ) => TQuery & { includeIds?: Array<string | number> };
  prepareExport: (
    options: ModuleExportOptions & { columns?: TCol[] },
  ) => { columns: TCol[]; context: TContext } | Promise<{ columns: TCol[]; context: TContext }>;
  loadByIds: (ids: string[]) => Promise<TRow[]>;
  loadPage: (
    query: TQuery & { includeIds?: Array<string | number> },
    page: number,
    limit: number,
    afterId?: string,
  ) => Promise<{ rows: TRow[]; hasMore: boolean; nextCursor?: string }>;
  /** Module-supplied CSV data-chunk generator for the streaming CSV path. */
  yieldDataChunks: (
    rows: TRow[],
    columns: TCol[],
    chunkSize: number,
    context: TContext,
  ) => Generator<string, void, undefined>;
  /** Optional cell extractor used for non-CSV formats (JSON / XLSX). */
  extractCell?: (row: TRow, columnId: string) => string | number | boolean | null | undefined;
};

/** Normalizes module columns to standard ExportColumn format, enforcing Field Whitelist. */
export function normalizeExportColumns<TCol extends ModuleCsvExportColumn>(
  columns: TCol[],
): ExportColumn[] {
  return columns
    .filter((col) => !isSystemMetadataKey(col.id ?? "") && !isSystemMetadataKey(col.label))
    .map((col) => ({
      id: col.id ?? col.label,
      label: col.label,
    }));
}
