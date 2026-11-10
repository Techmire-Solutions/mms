/**
 * @file hasanatExportService.ts
 * @description Hasanat card/ledger export — streamed CSV through `createModuleExportService`.
 *
 * The stream generator walks `listDistributionsPage` with keyset pagination and emits one CSV chunk
 * at a time, so a tenant with a large ledger never materializes the whole file in memory. Every
 * cell goes through `buildCsvContent` → `escapeCsvCell`, which neutralises spreadsheet formula
 * injection (`=`, `+`, `-`, `@`, `|`, `%`, leading tab/CR, whitespace-hidden formulas).
 */

import { HASANAT_MODULE_MANIFEST, buildCsvContent, type Distribution } from "@mms/shared";
import {
  createModuleExportService,
  type ModuleExportOptions,
  type ModuleExportQueryInput,
  type ModuleExportResult,
} from "../lib/createModuleExportService.js";
import { normalizeIncludeDeletedFlag } from "../lib/csvExportStreamFactory.js";
import { hasanatUseCases } from "../hasanat/use-cases/hasanatUseCases.js";

export interface HasanatExportColumn {
  id?: string;
  label: string;
}

export type HasanatExportQueryInput = ModuleExportQueryInput<{
  search?: string;
  status?: string;
  sortField?: string;
  sortDir?: "asc" | "desc";
  dateFrom?: string;
  dateTo?: string;
}>;

export type HasanatExportOptions = ModuleExportOptions<HasanatExportColumn>;
export type HasanatExportResult = ModuleExportResult;

/** The exportable card-summary projection (no internal audit/cascade columns). */
export const HASANAT_EXPORT_COLUMNS: HasanatExportColumn[] = [
  { id: "id", label: "Card ID" },
  { id: "issuedDate", label: "Issued Date" },
  { id: "recipientName", label: "Recipient" },
  { id: "recipientClass", label: "Class" },
  { id: "denominationName", label: "Denomination" },
  { id: "quantity", label: "Quantity" },
  { id: "points", label: "Points" },
  { id: "status", label: "Status" },
  { id: "expiresOn", label: "Expires On" },
  { id: "reason", label: "Reason" },
  { id: "issuedBy", label: "Issued By" },
];

/** One escaped CSV chunk; exported so the escaping/column order is unit-testable without a DB. */
export function buildHasanatExportCsvChunk(
  rows: readonly Distribution[],
  columns: readonly HasanatExportColumn[],
): string {
  return buildCsvContent(
    rows.map((row) => columns.map((column) => cellFor(row, column.id ?? column.label))),
  );
}

function cellFor(row: Distribution, columnId: string): string | number {
  switch (columnId) {
    case "id":
      return row.id;
    case "issuedDate":
      return row.issuedDate;
    case "recipientName":
      return row.recipientName ?? "";
    case "recipientClass":
      return row.recipientClass ?? "";
    case "denominationName":
      return row.denominationName ?? "";
    case "quantity":
      return row.quantity;
    case "points":
      // The immutable value stamped at issue (0230) — not the deed's current points.
      return row.pointsSnapshot ?? 0;
    case "status":
      return row.status;
    case "expiresOn":
      return row.expiresOn ?? "";
    case "reason":
      return row.reason ?? "";
    case "issuedBy":
      return row.issuedBy ?? "";
    default:
      return "";
  }
}

const hasanatCsv = createModuleExportService<
  Distribution,
  HasanatExportQueryInput,
  HasanatExportColumn
>({
  manifest: HASANAT_MODULE_MANIFEST,
  normalizeQuery: (query, allowDeleted) => ({
    ...query,
    includeDeleted: normalizeIncludeDeletedFlag(query.includeDeleted, allowDeleted),
  }),
  prepareExport: () => ({ columns: HASANAT_EXPORT_COLUMNS, context: undefined }),
  loadByIds: (ids) => hasanatUseCases.loadDistributionsByIds(ids, true),
  loadPage: async (query, page, limit, afterId) => {
    const result = await hasanatUseCases.loadDistributionsPage({
      ...(query as Record<string, unknown>),
      page,
      limit,
      ...(afterId ? { afterId } : {}),
      skipCount: true,
    } as never);
    const nextCursor = (result as { nextCursor?: string }).nextCursor;
    return {
      rows: result.distributions,
      hasMore: result.hasMore,
      ...(nextCursor ? { nextCursor } : {}),
    };
  },
  yieldDataChunks: (rows, columns, chunkSize) => {
    function* generate(): Generator<string, void, undefined> {
      for (let index = 0; index < rows.length; index += chunkSize) {
        yield buildHasanatExportCsvChunk(rows.slice(index, index + chunkSize), columns);
      }
    }
    return generate();
  },
  extractCell: (row, columnId) => cellFor(row, columnId),
});

export const generateHasanatCsvStreamChunks = hasanatCsv.generateStreamChunks;
export const buildHasanatCsvExport = hasanatCsv.buildExport as (
  query: HasanatExportQueryInput,
  options: HasanatExportOptions,
) => Promise<HasanatExportResult>;
