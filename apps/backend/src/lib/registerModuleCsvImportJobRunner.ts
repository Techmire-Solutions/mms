import { registerBackgroundJobRunner } from "../services/backgroundJobWorkerService.js";

export type ModuleCsvImportJobPayload<TRow = unknown> = {
  rows: TRow[];
  label?: string;
  viewerRole: string;
  language?: string;
};

export type RegisterModuleCsvImportJobRunnerOptions<TRow = unknown> = {
  moduleId: string;
  entityNounPlural: string;
  importBatch: (
    rows: TRow[],
    ctx: {
      tenant: string;
      userId: string;
      jobId: string;
      viewerRole: string;
      updateProgress: (current: number, total: number) => Promise<void>;
    },
  ) => Promise<{
    imported: number;
    failed?: number;
    total?: number;
    errors?: Array<{ row: number; reason: string }>;
  }>;
};

/**
 * Register `${moduleId}:import` background job runner.
 */
export function registerModuleCsvImportJobRunner<TRow = unknown>(
  options: RegisterModuleCsvImportJobRunnerOptions<TRow>,
): void {
  registerBackgroundJobRunner(`${options.moduleId}:import`, async (payload, ctx) => {
    const importPayload = payload as ModuleCsvImportJobPayload<TRow>;
    const rows = Array.isArray(importPayload.rows) ? importPayload.rows : [];
    const total = rows.length;

    await ctx.updateProgress(0, Math.max(total, 1));

    const result = await options.importBatch(rows, {
      tenant: ctx.tenant,
      userId: ctx.userId,
      jobId: ctx.jobId,
      viewerRole: importPayload.viewerRole,
      updateProgress: (current, tot) => ctx.updateProgress(current, tot),
    });

    const finalTotal = result.total ?? total;
    const importedCount = result.imported;
    const noun = options.entityNounPlural;
    const label =
      importPayload.label?.trim() || `Imported ${importedCount} of ${finalTotal} ${noun}`;

    await ctx.complete({
      label,
      progress: {
        current: importedCount,
        total: Math.max(finalTotal, 1),
      },
    });
  });
}
