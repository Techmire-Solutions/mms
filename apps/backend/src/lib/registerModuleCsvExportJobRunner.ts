import { PassThrough } from "node:stream";
import { buildTenantExportFilename } from "@mms/shared";
import {
  saveExportArtifact,
  saveStreamedExportArtifact,
} from "../services/exportArtifactService.js";
import { registerBackgroundJobRunner } from "../services/backgroundJobWorkerService.js";
import { uploadStreamToStorage, resolveTenantExportKey } from "../config/storage.js";

export type ModuleCsvExportJobPayload = {
  query?: unknown;
  columns?: unknown;
  filename?: string;
  label?: string;
  viewerRole: string;
  allowDeleted?: boolean;
};

export type RegisterModuleCsvExportJobRunnerOptions = {
  moduleId: string;
  entityNounPlural: string;
  buildExport: (
    query: Record<string, unknown>,
    options: {
      columns?: unknown;
      filename?: string;
      viewerRole: string;
      allowDeleted?: boolean;
    },
    tenant?: string,
  ) => Promise<{ csv: string; filename: string; count: number }>;
  /**
   * Optional streaming generator. When provided, the runner streams the CSV to
   * blob storage (S3/local) instead of buffering the whole artifact in memory,
   * then stores only the storage key. Falls back to the buffered `buildExport`
   * path when absent.
   */
  generateStreamChunks?: (
    query: Record<string, unknown>,
    options: {
      columns?: unknown;
      filename?: string;
      viewerRole: string;
      allowDeleted?: boolean;
    },
    tenant?: string,
  ) => AsyncGenerator<string, { count: number; filename: string }, undefined>;
};

/** Streams a CSV generator to storage and records the keyed artifact. */
async function streamCsvToStorage(
  ctx: { tenant: string; userId: string; jobId: string },
  exportPayload: ModuleCsvExportJobPayload,
  options: RegisterModuleCsvExportJobRunnerOptions,
): Promise<{ filename: string; count: number }> {
  const passThrough = new PassThrough();
  const rawFallback = exportPayload.filename?.trim() || "export.csv";
  const fallbackFilename = buildTenantExportFilename(ctx.tenant, rawFallback);
  const filename = fallbackFilename.toLowerCase().endsWith(".csv")
    ? fallbackFilename
    : `${fallbackFilename}.csv`;
  const key = resolveTenantExportKey(ctx.tenant, filename);
  const uploadPromise = uploadStreamToStorage(
    ctx.tenant,
    key,
    passThrough,
    "text/csv; charset=utf-8",
  );

  const generator = options.generateStreamChunks!(
    (exportPayload.query ?? {}) as Record<string, unknown>,
    {
      columns: exportPayload.columns,
      filename,
      viewerRole: exportPayload.viewerRole,
      allowDeleted: exportPayload.allowDeleted === true,
    },
    ctx.tenant,
  );

  try {
    let step = await generator.next();
    while (!step.done) {
      if (!passThrough.write(step.value)) {
        // Apply backpressure so the in-memory buffer stays bounded to a few chunks.
        await new Promise<void>((resolve) => passThrough.once("drain", () => resolve()));
      }
      step = await generator.next();
    }
    const meta = step.value; // { count, filename }
    passThrough.end();
    const result = await uploadPromise;

    await saveStreamedExportArtifact(ctx.userId, ctx.jobId, {
      key: result.key,
      storageType: result.storageType,
      filename: meta?.filename || filename,
      contentType: "text/csv; charset=utf-8",
    });

    return { filename: meta?.filename || filename, count: meta?.count ?? 0 };
  } catch (error) {
    // Ensure the stream and upload settle so no handle leaks on error (mirrors
    // streamTableToExcel). Without this, a generator error leaves the
    // passThrough open and the uploadPromise pending forever.
    passThrough.destroy(error instanceof Error ? error : new Error(String(error)));
    await uploadPromise.catch(() => {});
    throw error;
  }
}

/** Register `${moduleId}:export` CSV background job runner (Contacts/Students). */
export function registerModuleCsvExportJobRunner(
  options: RegisterModuleCsvExportJobRunnerOptions,
): void {
  registerBackgroundJobRunner(`${options.moduleId}:export`, async (payload, ctx) => {
    const exportPayload = payload as ModuleCsvExportJobPayload;
    await ctx.updateProgress(0, 1);

    let count: number;
    if (options.generateStreamChunks) {
      const result = await streamCsvToStorage(ctx, exportPayload, options);
      count = result.count;
    } else {
      const rawFallback = exportPayload.filename?.trim() || "export.csv";
      const targetFilename = buildTenantExportFilename(ctx.tenant, rawFallback);
      const result = await options.buildExport(
        (exportPayload.query ?? {}) as Record<string, unknown>,
        {
          columns: exportPayload.columns,
          filename: targetFilename,
          viewerRole: exportPayload.viewerRole,
          allowDeleted: exportPayload.allowDeleted === true,
        },
        ctx.tenant,
      );
      count = result.count;
      await saveExportArtifact(ctx.userId, ctx.jobId, result.csv, result.filename);
    }

    await ctx.complete({
      label: exportPayload.label ?? `Exported ${count} ${options.entityNounPlural}`,
      progress: { current: count, total: count },
      hasDownload: true,
    });
  });
}
