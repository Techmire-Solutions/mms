/**
 * @file workshopsExportService.ts
 * @description Workshops (events) CSV export, wired to the shared data-transfer schema SSOT.
 */
import { buildTenantExportFilename, type ExportColumn, type WorkshopEvent } from "@mms/shared";
import { workshopsTransferSchema } from "@mms/shared";
import { throwIfBackgroundJobAborted } from "../lib/backgroundJobAbort.js";
import { workshopsRepository } from "../workshops/repository/workshopsRepositoryAdapter.js";

export type WorkshopsExportQuery = Record<string, unknown>;

export type WorkshopsExportOptions = {
  columns?: unknown;
  filename?: string;
  viewerRole: string;
  allowDeleted?: boolean;
};

/**
 * Buffered CSV export for workshop events. Paged through `listWorkshopsPage` so the whole
 * result set is never held twice; the grid is produced by the `workshopsTransferSchema` SSOT
 * (field whitelist + header symmetry enforced at the root generation layer).
 */
export async function buildWorkshopsCsvExport(
  query: WorkshopsExportQuery,
  options: WorkshopsExportOptions,
  tenant?: string,
  signal?: AbortSignal,
): Promise<{ csv: string; filename: string; count: number }> {
  const columns =
    Array.isArray(options.columns) && options.columns.length > 0
      ? (options.columns as ExportColumn[])
      : workshopsTransferSchema.exportColumns;

  const all: WorkshopEvent[] = [];
  let page = 1;
  for (;;) {
    throwIfBackgroundJobAborted(signal);
    const result = await workshopsRepository.listWorkshopsPage(tenant ?? "", {
      page,
      limit: 500,
      search: typeof query.search === "string" ? query.search : "",
      sortField: typeof query.sortField === "string" ? query.sortField : "startDate",
      sortDir: query.sortDir === "asc" ? "asc" : "desc",
      includeDeleted: options.allowDeleted === true,
    });
    all.push(...result.workshops);
    if (!result.hasMore) break;
    page += 1;
  }

  const csv = workshopsTransferSchema.toExportCsv(all, columns);
  const rawFilename = options.filename?.trim() || "workshops.csv";
  const filename = buildTenantExportFilename(tenant ?? "", rawFilename);
  return {
    csv,
    filename: filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`,
    count: all.length,
  };
}
