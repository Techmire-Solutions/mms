/** Background-job run context the worker passes to a module runner. */
export interface BackgroundJobRunContext {
  tenant: string;
  userId: string;
  jobId: string;
  signal?: AbortSignal;
  /** 1-based attempt number for this execution (BullMQ `attemptsMade + 1`). */
  attempt?: number;
  /** Configured attempt ceiling (BullMQ `opts.attempts`). */
  maxAttempts?: number;
  /** Current role resolved at execution (field visibility); null when unresolved. */
  viewerRole?: string | null;
  /** Whether the current role may view soft-deleted rows (delete/trash permission). */
  allowDeleted?: boolean;
  updateProgress: (current: number, total: number) => Promise<void>;
  complete: (patch?: Record<string, unknown>) => Promise<void>;
  fail: (error: string) => Promise<void>;
}
