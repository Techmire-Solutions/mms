import type { BackgroundJobRecord } from "@mms/shared";
import { buildBackgroundJobId, buildDeterministicJobKey } from "./backgroundJobIds.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  getUserBackgroundJobPayload,
} from "../services/backgroundJobWorkerService.js";
import { ConflictError } from "./httpErrors.js";

/** Strip includeDeleted from export query when the viewer cannot access trash. */
export function normalizeExportQuery(
  query: Record<string, unknown> | undefined,
  allowDeleted: boolean,
): Record<string, unknown> {
  const next = { ...(query ?? {}) };
  if (!allowDeleted) {
    delete next.includeDeleted;
  }
  return next;
}

export type EnqueueCsvExportJobInput = {
  tenant: string;
  userId: string;
  moduleId: string;
  /** Background job kind suffix; defaults to `export`. */
  kind?: string;
  label: string;
  query: Record<string, unknown>;
  columns?: Array<{ id: string; label: string }>;
  filename?: string;
  viewerRole: string;
  allowDeleted: boolean;
  idempotencyKey?: string;
};

/**
 * Idempotent CSV export job enqueue. Returns an existing job when the idempotency key hits.
 */
export async function enqueueCsvExportJob(
  input: EnqueueCsvExportJobInput,
): Promise<BackgroundJobRecord> {
  const idempotencyKey =
    input.idempotencyKey ??
    buildDeterministicJobKey({
      moduleId: input.moduleId,
      kind: input.kind ?? "export",
      payload: {
        query: input.query,
        columns: input.columns,
        filename: input.filename,
        allowDeleted: input.allowDeleted,
      },
    });
  const jobId = buildBackgroundJobId(input.tenant, input.userId, idempotencyKey);
  const existing = await getUserBackgroundJob(input.userId, jobId);
  if (existing) {
    const stored = await getUserBackgroundJobPayload(input.userId, jobId);
    if (stored && stored.query !== undefined) {
      if (JSON.stringify(stored.query) !== JSON.stringify(input.query)) {
        throw new ConflictError(
          "This idempotency key was already used for a different export — start a new export",
        );
      }
    }
    return existing;
  }

  const kind = input.kind ?? "export";
  const runningJob: BackgroundJobRecord = {
    id: jobId,
    moduleId: input.moduleId,
    kind,
    status: "running",
    label: input.label,
    createdAt: new Date().toISOString(),
  };

  return enqueueBackgroundJob(input.tenant, input.userId, runningJob, {
    query: input.query,
    columns: input.columns,
    filename: input.filename,
    label: input.label,
    viewerRole: input.viewerRole,
    allowDeleted: input.allowDeleted,
  });
}
