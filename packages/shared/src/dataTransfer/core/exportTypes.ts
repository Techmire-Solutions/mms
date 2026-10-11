/**
 * @file exportTypes.ts
 * @description Core types for the generic cross-module export pipeline.
 *
 * Every module implements `ExportSpec<TRow, TSettings>` once and plugs it
 * into `filterExportColumnsByVisibility` + `buildExportGrid`; no per-module
 * duplication of filtering or row-building logic is needed.
 */

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

/** Minimal exportable column descriptor (id + display label). */
export interface ExportColumn {
  id: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

/** Supported serialisation targets for module exports. */
export type ExportFormat = "csv" | "json" | "xlsx";

// ---------------------------------------------------------------------------
// Cell extractor
// ---------------------------------------------------------------------------

/**
 * Pure function: given a raw entity row and a column id, return the
 * serialisable cell value for that column.
 *
 * Returning `undefined` or `null` serialises to an empty string in CSV/XLSX
 * and `null` in JSON.
 */
export type ExportCellExtractor<TRow> = (
  row: TRow,
  columnId: string,
) => string | number | boolean | null | undefined;

// ---------------------------------------------------------------------------
// Module spec contract
// ---------------------------------------------------------------------------

/**
 * Module-supplied contract consumed by the generic export pipeline.
 *
 * Each feature module creates **one** `ExportSpec` object and passes it to
 * `createModuleExportService`. This replaces the per-module
 * `filterXxxExportColumnsForViewer` + `buildXxxExportRows` functions.
 *
 * @template TRow      - The entity type (e.g. `Student`, `FacultyMember`).
 * @template TSettings - The module settings type (e.g. `StudentsSettings`).
 */
export interface ExportSpec<TRow, TSettings = unknown> {
  /** Columns rendered when the caller provides none. */
  defaultColumns: ExportColumn[];

  /**
   * Visibility filter — replaces per-module `filterXxxForViewer`.
   *
   * Must return a strict subset (or equal set) of the supplied `columns`
   * array preserving original order.
   */
  filterColumns(
    columns: ExportColumn[],
    settings: TSettings | null | undefined,
    viewerRole: string,
  ): ExportColumn[];

  /**
   * Cell extractor — pure, no I/O.
   * Identical for every serialisation format (CSV, JSON, XLSX).
   */
  extractCell: ExportCellExtractor<TRow>;
}
