/**
 * @file importTypes.ts
 * @description Core types for the generic cross-module import pipeline.
 *
 * Each module implements `ImportSpec<TRow>` and passes it to
 * `runImportPipeline`, which handles: parse → Zod validate → sanitize →
 * optional transform → batch-persist with per-row error reporting.
 */
import type { z } from "zod";
import { CSV_IMPORT_MAX_BATCH_DEFAULT } from "../../schemas/csvImport.dto.js";

// ---------------------------------------------------------------------------
// Error & result types
// ---------------------------------------------------------------------------

/** Row-level import error (1-based row index, human-readable reason). */
export interface ImportRowError {
  /** 1-based row number matching the source CSV row position. */
  row: number;
  reason: string;
}

/** Aggregate result returned by `runImportPipeline` and job runners. */
export interface ImportResult {
  total: number;
  imported: number;
  failed: number;
  errors?: ImportRowError[];
}

// ---------------------------------------------------------------------------
// Per-module spec
// ---------------------------------------------------------------------------

/**
 * Module-supplied contract consumed by `runImportPipeline`.
 *
 * @template TRow - The typed entity shape after successful validation.
 */
export interface ImportSpec<TRow> {
  /**
   * Zod schema applied once per raw row (after `deepSanitizeStrings`).
   * Validation failures are collected as `ImportRowError` entries — the
   * pipeline never throws for per-row errors.
   */
  rowSchema: z.ZodType<TRow>;

  /**
   * Maximum rows accepted in a single pipeline run.
   * Defaults to `CSV_IMPORT_MAX_BATCH_DEFAULT` (500).
   */
  maxBatch?: number;

  /**
   * Optional post-validation transform applied after Zod parse succeeds.
   * Throw an `Error` to reject the row; the message becomes the `reason`.
   */
  transform?: (row: TRow, rowIndex: number) => TRow | Promise<TRow>;
}

export { CSV_IMPORT_MAX_BATCH_DEFAULT };
