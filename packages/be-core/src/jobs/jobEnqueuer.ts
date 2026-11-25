import type { BackgroundJobRecord } from "@mms/contracts";

/** Thrown when the BullMQ-backed task queue cannot accept a new job. */
export class QueueUnavailableError extends Error {
  constructor(
    message = "Failed to enqueue background job. The task queue service may be unavailable.",
  ) {
    super(message);
    this.name = "QueueUnavailableError";
  }
}

/** Thrown when the caller has hit the retained-job ceiling. */
export class BackgroundJobLimitError extends Error {
  constructor(max: number) {
    super(
      `Too many retained background jobs (limit ${max}); clear finished jobs from the task tray and retry`,
    );
    this.name = "BackgroundJobLimitError";
  }
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
  /** W3C traceparent to propagate into execution-time audit rows. */
  correlationId?: string;
};

/** Strip includeDeleted from an export query when the viewer cannot access trash. */
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

/**
 * The app-runtime seam a module (or a shared route factory) uses to enqueue
 * background jobs without importing the app. `apps/api` configures this once at
 * startup with the real queue-backed implementation.
 */
export interface JobEnqueuer {
  getUserJob(userId: string, jobId: string): Promise<BackgroundJobRecord | null>;
  enqueueJob(
    tenant: string,
    userId: string,
    job: BackgroundJobRecord,
    payload: unknown,
  ): Promise<BackgroundJobRecord>;
  enqueueCsvExport(input: EnqueueCsvExportJobInput): Promise<BackgroundJobRecord>;
  isQueueUnavailable(error: unknown): boolean;
}

let enqueuer: JobEnqueuer | null = null;

export function configureJobEnqueuer(port: JobEnqueuer): void {
  enqueuer = port;
}

export function getJobEnqueuer(): JobEnqueuer {
  if (!enqueuer) throw new Error("Job enqueuer is not configured");
  return enqueuer;
}
