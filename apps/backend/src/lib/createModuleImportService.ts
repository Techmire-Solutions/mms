/**
 * @file createModuleImportService.ts
 * @description Generic module import service factory.
 *
 * One call per module:
 *  1. Registers the `${moduleId}:import` BullMQ job runner via
 *     `registerModuleCsvImportJobRunner`.
 *  2. Returns a typed `runImport` function for direct (non-queued) invocations.
 *
 * This replaces the ad-hoc `importBatch` implementations in each module's
 * `*ImportJobUseCases.ts` file by moving the validate→sanitize→transform
 * orchestration into `runImportPipeline` (packages/shared/src/dataTransfer).
 *
 * @example
 * // apps/backend/src/students/studentsImportService.ts
 * export const studentsImport = createModuleImportService({
 *   moduleId: 'students',
 *   entityNounPlural: 'students',
 *   spec: {
 *     rowSchema: studentImportRowSchema,
 *     maxBatch: 500,
 *   },
 *   persist: async (rows, ctx) => persistStudentRows(rows, ctx),
 * });
 * studentsImport.registerJobRunner();
 */
import type { ImportSpec, ImportResult } from "@mms/shared";
import { runImportPipeline, type ImportBatchFn, type ImportPipelineContext } from "@mms/shared";
import { registerModuleCsvImportJobRunner } from "./registerModuleCsvImportJobRunner.js";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CreateModuleImportServiceOptions<TRow> {
  /** Module ID — e.g. `'students'`, `'contacts'`. Used as `${moduleId}:import` job key. */
  moduleId: string;
  /** Plural noun used in job labels, e.g. `'students'`, `'faculty members'`. */
  entityNounPlural: string;
  /** Module-supplied Zod schema + optional transform config. */
  spec: ImportSpec<TRow>;
  /**
   * Persistence callback — receives validated+transformed rows, returns
   * `{ imported, errors? }`. Row-level DB errors should be surfaced here.
   */
  persist: ImportBatchFn<TRow>;
}

// ---------------------------------------------------------------------------
// Returned service type
// ---------------------------------------------------------------------------

export interface ModuleImportService<_TRow = unknown> {
  /**
   * Registers the `${moduleId}:import` BullMQ background job runner.
   * Must be called once during server startup (before any jobs can run).
   */
  registerJobRunner(): void;

  /**
   * Runs the import pipeline inline (synchronous callers).
   * Useful for test fixtures or small in-request imports (< 50 rows).
   */
  runImport(rawRows: unknown[], ctx: ImportPipelineContext): Promise<ImportResult>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a reusable import service for a single module.
 * Call `service.registerJobRunner()` during app startup.
 */
export function createModuleImportService<TRow>(
  options: CreateModuleImportServiceOptions<TRow>,
): ModuleImportService<TRow> {
  const { moduleId, entityNounPlural, spec, persist } = options;

  function runImport(rawRows: unknown[], ctx: ImportPipelineContext): Promise<ImportResult> {
    return runImportPipeline(rawRows, spec, persist, ctx);
  }

  function registerJobRunner(): void {
    registerModuleCsvImportJobRunner<TRow>({
      moduleId,
      entityNounPlural,
      importBatch: (rows, ctx) =>
        runImportPipeline(rows as unknown[], spec, persist, {
          tenant: ctx.tenant,
          userId: ctx.userId,
          jobId: ctx.jobId,
          viewerRole: ctx.viewerRole,
          updateProgress: (current, total) => ctx.updateProgress(current, total),
        }),
    });
  }

  return { registerJobRunner, runImport };
}
