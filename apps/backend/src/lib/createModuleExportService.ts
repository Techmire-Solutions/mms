/**
 * @file createModuleExportService.ts
 * @description Generic module export service factory with multi-format support (CSV/JSON/XLSX).
 */
import type { ExportFormat } from "@mms/shared";
import { buildTenantExportFilename, buildExportGrid } from "@mms/shared";
import {
  buildCsvExportFromGenerator,
  generateCsvStreamChunks,
  streamCsvExportFromGenerator,
} from "./csvExportStreamFactory.js";
import { getSerializer } from "./exportSerializerResolver.js";
import { getRequestTenant } from "./tenantContext.js";
import { xlsxSerializer } from "./xlsxExportSerializer.js";
import {
  normalizeExportColumns,
  type CreateModuleExportServiceOptions,
  type ModuleCsvExportColumn,
  type ModuleExportOptions,
  type ModuleExportResult,
} from "./createModuleExportServiceTypes.js";

export * from "./createModuleExportServiceTypes.js";

function resolveFilename(rawFilename: string, ext: string): string {
  const base = rawFilename.endsWith(ext) ? rawFilename : `${rawFilename}${ext}`;
  return buildTenantExportFilename(getRequestTenant(), base);
}

export function createModuleExportService<
  TRow,
  TQuery,
  TCol extends ModuleCsvExportColumn,
  TContext = undefined,
>(options: CreateModuleExportServiceOptions<TRow, TQuery, TCol, TContext>) {
  async function* generateStreamChunks(
    query: TQuery,
    exportOptions: ModuleExportOptions & { columns?: TCol[] },
  ): AsyncGenerator<string, { count: number; filename: string }, undefined> {
    const normalized = options.normalizeQuery(query, exportOptions.allowDeleted === true);
    const includeIds = normalized.includeIds?.map(String).filter(Boolean);
    const prepared = await options.prepareExport(exportOptions);
    const rawFilename = exportOptions.filename?.trim() || options.manifest.defaultExportFilename;
    const filename = resolveFilename(rawFilename, ".csv");
    const chunkSize = Math.max(1, exportOptions.chunkSize ?? options.manifest.exportChunkSize);

    return yield* generateCsvStreamChunks({
      filename,
      chunkSize,
      columns: prepared.columns,
      includeIds,
      loadByIds: options.loadByIds,
      loadPage: async (page, limit, afterId) => options.loadPage(normalized, page, limit, afterId),
      yieldDataChunks: (rows, cols, size) =>
        options.yieldDataChunks(rows as TRow[], cols as TCol[], size, prepared.context),
    });
  }

  function streamExport(query: TQuery, exportOptions: ModuleExportOptions & { columns?: TCol[] }) {
    return streamCsvExportFromGenerator(generateStreamChunks(query, exportOptions));
  }

  async function loadAllExportRows(
    query: TQuery,
    exportOptions: ModuleExportOptions & { columns?: TCol[] },
  ): Promise<TRow[]> {
    const normalized = options.normalizeQuery(query, exportOptions.allowDeleted === true);
    const includeIds = normalized.includeIds?.map(String).filter(Boolean);
    const allRows: TRow[] = [];

    if (includeIds && includeIds.length > 0) {
      const batchSize = options.manifest.exportChunkSize;
      for (let i = 0; i < includeIds.length; i += batchSize) {
        const chunk = await options.loadByIds(includeIds.slice(i, i + batchSize));
        allRows.push(...chunk);
      }
    } else {
      let page = 1;
      let cursor: string | undefined;
      for (;;) {
        const pageResult = await options.loadPage(normalized, page, 250, cursor);
        allRows.push(...(pageResult.rows as TRow[]));
        if (!pageResult.hasMore) break;
        const last = pageResult.rows[pageResult.rows.length - 1] as { id?: unknown } | undefined;
        cursor = pageResult.nextCursor ?? (last?.id ? String(last.id) : undefined);
        page += 1;
      }
    }
    return allRows;
  }

  async function buildExport(
    query: TQuery,
    exportOptions: ModuleExportOptions & { columns?: TCol[] },
  ): Promise<ModuleExportResult> {
    const format: ExportFormat = exportOptions.format ?? "csv";

    if (format === "csv") {
      const rawFilename = exportOptions.filename?.trim() || options.manifest.defaultExportFilename;
      const filename = resolveFilename(rawFilename, ".csv");
      const result = await buildCsvExportFromGenerator(
        generateStreamChunks(query, exportOptions),
        filename,
      );
      return {
        content: result.csv,
        csv: result.csv,
        filename: result.filename,
        count: result.count,
        format: "csv",
        contentType: "text/csv; charset=utf-8",
      };
    }

    if (!options.extractCell) {
      throw new Error(`Format "${format}" requires extractCell to be defined in options.`);
    }

    const allRows = await loadAllExportRows(query, exportOptions);
    const prepared = await options.prepareExport(exportOptions);
    const exportColumns = normalizeExportColumns(prepared.columns);
    const serializer = getSerializer(format);
    const rawFilename = exportOptions.filename?.trim() || options.manifest.defaultExportFilename;
    const filename = resolveFilename(rawFilename, serializer.fileExtension);
    const grid = buildExportGrid(allRows, exportColumns, options.extractCell);

    if (format === "xlsx") {
      const buf = await xlsxSerializer.serializeBufferAsync(grid);
      return {
        content: buf.toString("base64"),
        csv: "",
        filename,
        count: allRows.length,
        format: "xlsx",
        contentType: serializer.contentType,
      };
    }

    const content = serializer.serialize(grid);
    return {
      content,
      csv: "",
      filename,
      count: allRows.length,
      format,
      contentType: serializer.contentType,
    };
  }

  return { generateStreamChunks, streamExport, buildExport };
}
