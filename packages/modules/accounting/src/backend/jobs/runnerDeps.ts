import type { BackgroundJobRecord } from "@mms/contracts";

/**
 * Structural mirror of the backend's CSV-import runner context. The accounting
 * module cannot import `apps/backend` (boundaries), so the port restates the
 * shape here and the backend adapter supplies a compatible object.
 */
export interface AccountingCsvImportJobContext {
  tenant: string;
  userId: string;
  jobId: string;
  viewerRole: string;
  signal?: AbortSignal;
  updateProgress: (current: number, total: number) => Promise<void>;
}

export interface AccountingCsvImportJobResult {
  imported: number;
  failed?: number;
  total?: number;
  errors?: Array<{ row: number; reason: string }>;
}

export interface AccountingCsvImportJobRunnerOptions {
  moduleId: string;
  entityNounPlural: string;
  importBatch: (
    rows: unknown[],
    ctx: AccountingCsvImportJobContext,
  ) => Promise<AccountingCsvImportJobResult>;
}

export interface AccountingCsvExportJobOptions {
  columns?: unknown;
  filename?: string;
  viewerRole: string;
  allowDeleted?: boolean;
}

export interface AccountingCsvExportJobRunnerOptions {
  moduleId: string;
  /** Background job kind suffix; defaults to `export` (e.g. `export-ledger`). */
  kind?: string;
  entityNounPlural: string;
  buildExport: (
    query: Record<string, unknown>,
    options: AccountingCsvExportJobOptions,
    tenant?: string,
    signal?: AbortSignal,
  ) => Promise<{ csv: string; filename: string; count: number }>;
  generateStreamChunks?: (
    query: Record<string, unknown>,
    options: AccountingCsvExportJobOptions,
    tenant?: string,
  ) => AsyncGenerator<string, { count: number; filename: string }, undefined>;
}

/** Context handed to `${moduleId}:<kind>` handlers; mirrors the backend runner context. */
export interface AccountingBackgroundJobContext {
  tenant: string;
  userId: string;
  jobId: string;
  signal?: AbortSignal;
  updateProgress: (current: number, total: number) => Promise<void>;
  complete: (patch?: Partial<BackgroundJobRecord>) => Promise<void>;
}

export interface AccountingRunnerDeps {
  registerCsvImportJobRunner(options: AccountingCsvImportJobRunnerOptions): void;
  registerCsvExportJobRunner(options: AccountingCsvExportJobRunnerOptions): void;
  registerBackgroundJobRunner(
    kind: string,
    handler: (payload: unknown, ctx: AccountingBackgroundJobContext) => Promise<void>,
  ): void;
  buildReportDocument(body: unknown): Promise<{
    template: string;
    data: unknown;
    filename: string;
    lang: string;
    direction: string;
  }>;
  processPdfRenderJob(
    tenant: string,
    document: Record<string, unknown>,
    progress: (percent: number) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<{ key: string; storageType: string }>;
  saveArtifact(
    userId: string,
    jobId: string,
    artifact: { key: string; storageType: string; filename: string; contentType: string },
  ): Promise<void>;
}

let deps: AccountingRunnerDeps | null = null;
export function configureAccountingRunnerDeps(value: AccountingRunnerDeps): void {
  deps = value;
}
export function getAccountingRunnerDeps(): AccountingRunnerDeps {
  if (!deps) throw new Error("Accounting background job runner dependencies are not configured");
  return deps;
}
export type { BackgroundJobRecord };
