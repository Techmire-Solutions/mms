import type { BackgroundJobRecord } from "@mms/contracts";

/**
 * Execution context handed to a registered background-job runner.
 *
 * The app's job runtime (`apps/api`) populates the callbacks; module runners
 * receive this and drive progress/termination through them, so no module ever
 * imports the app runtime.
 */
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
  complete: (patch?: Partial<BackgroundJobRecord>) => Promise<void>;
  fail: (error: string) => Promise<void>;
}

export type BackgroundJobRunner = (
  payload: unknown,
  runContext: BackgroundJobRunContext,
) => Promise<void>;

/**
 * Process-wide registry of `moduleId:kind` → runner. Modules register runners;
 * the app runtime executes them. This lives in `be-core` so a module can
 * register a runner without importing the app.
 */
const runners = new Map<string, BackgroundJobRunner>();

export function registerBackgroundJobRunner(key: string, runner: BackgroundJobRunner): void {
  runners.set(key, runner);
}

export function getBackgroundJobRunner(key: string): BackgroundJobRunner | undefined {
  return runners.get(key);
}

export function hasBackgroundJobRunner(key: string): boolean {
  return runners.has(key);
}
