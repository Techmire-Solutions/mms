/**
 * @file buildExportGrid.ts
 * @description Generic 2D grid builder for entity export rows.
 *
 * Replaces the six near-identical per-module functions:
 *   - buildStudentsExportRows
 *   - buildFacultyExportRows
 *   - buildContactsExportRows (indirect, via extractors)
 *   - buildEnrollmentsExportRows
 *   - buildSessionsExportRows
 *   - buildUsersExportRows
 */
import type { ExportColumn, ExportCellExtractor } from "../core/exportTypes.js";
import { filterNonMetadataColumns } from "../core/systemMetadata.js";

// ---------------------------------------------------------------------------
// Primary export
// ---------------------------------------------------------------------------

/**
 * Builds a 2D grid `[headerRow, ...dataRows]` suitable for any serialiser.
 *
 * - Row 0 is the header (column labels).
 * - Rows 1…N are entity data: one cell per column, derived via `extractCell`.
 * - `null` / `undefined` cell values become empty strings here so serialisers
 *   receive a clean `unknown[][]` with no missing entries.
 * - System metadata columns are strictly stripped per Field Whitelist invariant.
 *
 * @param rows        - Entity records to export.
 * @param columns     - Columns to include (already filtered by visibility).
 * @param extractCell - Module-supplied pure cell extractor.
 */
export function buildExportGrid<TRow>(
  rows: TRow[],
  columns: ExportColumn[],
  extractCell: ExportCellExtractor<TRow>,
): unknown[][] {
  const safeColumns = filterNonMetadataColumns(columns);
  const header = safeColumns.map((col) => col.label);
  const dataRows = rows.map((row) =>
    safeColumns.map((col) => {
      const val = extractCell(row, col.id);
      return val === null || val === undefined ? "" : val;
    }),
  );
  return [header, ...dataRows];
}

// ---------------------------------------------------------------------------
// Streaming variant (yields chunks instead of materialising the full grid)
// ---------------------------------------------------------------------------

/**
 * Generator version of `buildExportGrid` — yields each data row as a
 * single-element `unknown[][]` chunk so callers can pipe to a stream
 * serialiser without materialising the full result in memory.
 *
 * The header row is yielded first.
 * System metadata columns are strictly stripped per Field Whitelist invariant.
 */
export function* yieldExportGridChunks<TRow>(
  rows: TRow[],
  columns: ExportColumn[],
  extractCell: ExportCellExtractor<TRow>,
  chunkSize = 100,
): Generator<unknown[][], void, undefined> {
  const safeColumns = filterNonMetadataColumns(columns);
  yield [safeColumns.map((col) => col.label)];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    yield chunk.map((row) =>
      safeColumns.map((col) => {
        const val = extractCell(row, col.id);
        return val === null || val === undefined ? "" : val;
      }),
    );
  }
}
