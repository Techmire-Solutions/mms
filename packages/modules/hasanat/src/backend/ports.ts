/**
 * App-bound ports for the hasanat module.
 *
 * The module never imports `apps/api`; the composition root binds these once
 * (`apps/api/src/modules/hasanat/adapters.ts`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HasanatEnqueueBackgroundJob = (...args: any[]) => Promise<any>;

export interface HasanatCsvExportOptions {
  columns?: unknown;
  filename?: string;
  viewerRole: string;
  allowDeleted?: boolean;
}

export interface HasanatCsvExportRunnerOptions {
  moduleId: string;
  kind?: string;
  entityNounPlural: string;
  buildExport: (
    query: Record<string, unknown>,
    options: HasanatCsvExportOptions,
    tenant?: string,
    signal?: AbortSignal,
  ) => Promise<{ csv: string; filename: string; count: number }>;
  generateStreamChunks?: (
    query: Record<string, unknown>,
    options: HasanatCsvExportOptions,
    tenant?: string,
  ) => AsyncGenerator<unknown, { count: number; filename: string }, undefined>;
}

export interface HasanatPorts {
  /** Enqueue a background job (card award jobs, CSV exports). */
  enqueueBackgroundJob: HasanatEnqueueBackgroundJob;
  /** Register the `<moduleId>:export` CSV background job runner. */
  registerModuleCsvExportJobRunner: (options: HasanatCsvExportRunnerOptions) => void;
}
