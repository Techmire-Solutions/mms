/**
 * @file importPipelineRunner.ts
 * @description Orchestrates the full import pipeline:
 *   parse (pre-validated rows) → Zod validate → sanitize → optional transform → batch-persist.
 *
 * Modules pass their `ImportSpec<TRow>` and a `persist` callback; this
 * function handles progress reporting, chunking, and error collection.
 */
import type { ImportSpec, ImportResult, ImportRowError } from "../core/importTypes.js";
import { validateImportRows } from "./validateImportRows.js";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Runtime context supplied by the background-job runner or inline caller.
 * Mirrors the context provided by `registerModuleCsvImportJobRunner`.
 */
export interface ImportPipelineContext {
  tenant: string;
  userId: string;
  jobId: string;
  viewerRole: string;
  updateProgress(current: number, total: number): Promise<void>;
}

// ---------------------------------------------------------------------------
// Batch-persist callback type
// ---------------------------------------------------------------------------

/**
 * Module-supplied persistence function.
 *
 * Receives a chunk of validated + transformed rows, persists them, and
 * returns how many succeeded. Row-level errors within a persist call are
 * also surfaced here (e.g. unique-constraint violations per row).
 */
export type ImportBatchFn<TRow> = (
  rows: TRow[],
  ctx: ImportPipelineContext,
) => Promise<{ imported: number; errors?: ImportRowError[] }>;

// ---------------------------------------------------------------------------
// Pipeline runner
// ---------------------------------------------------------------------------

/**
 * Generic import pipeline:
 *
 * 1. **Validate** — `validateImportRows` sanitises strings, then Zod parses
 *    each row. Per-row failures are collected, not thrown.
 * 2. **Transform** — optional `spec.transform` applied post-Zod.
 *    Throwing inside `transform` rejects the row and records an error.
 * 3. **Batch-persist** — `persist` is called in chunks of `spec.maxBatch`.
 *    Progress is reported after each chunk.
 *
 * @returns `ImportResult` with total/imported/failed counts and error list.
 */
export async function runImportPipeline<TRow>(
  rawRows: unknown[],
  spec: ImportSpec<TRow>,
  persist: ImportBatchFn<TRow>,
  ctx: ImportPipelineContext,
): Promise<ImportResult> {
  const total = rawRows.length;
  const allErrors: ImportRowError[] = [];
  const maxBatch = spec.maxBatch ?? 500;

  await ctx.updateProgress(0, Math.max(total, 1));

  // Step 1 — Validate
  const { valid, errors: validationErrors } = validateImportRows(rawRows, spec.rowSchema);
  allErrors.push(...validationErrors);

  // Step 2 — Optional transform
  const transformed: TRow[] = [];
  if (spec.transform) {
    for (let i = 0; i < valid.length; i++) {
      try {
        transformed.push(await spec.transform(valid[i], i));
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        // Map back to 1-based index within the original rawRows array.
        const originalRow = i + validationErrors.filter((e) => e.row <= i + 1).length + 1;
        allErrors.push({ row: originalRow, reason });
      }
    }
  } else {
    transformed.push(...valid);
  }

  // Step 3 — Batch-persist in chunks
  let imported = 0;
  for (let offset = 0; offset < transformed.length; offset += maxBatch) {
    const chunk = transformed.slice(offset, offset + maxBatch);
    const result = await persist(chunk, ctx);
    imported += result.imported;
    if (result.errors) allErrors.push(...result.errors);
    await ctx.updateProgress(imported, Math.max(total, 1));
  }

  const failed = total - imported;
  return {
    total,
    imported,
    failed,
    errors: allErrors.length > 0 ? allErrors : undefined,
  };
}
