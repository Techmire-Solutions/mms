import { settleInFlight } from "../lib/backgroundJobAbort.js";
import { resolveJobExecutionTimeoutMs } from "../worker/queues/queueConfig.js";

/** Raised into the runner when its wall-clock budget expires. */
export class JobDeadlineExceededError extends Error {
  constructor(timeoutMs: number) {
    super(`Background job exceeded its ${Math.round(timeoutMs / 1000)}s execution budget`);
    this.name = "JobDeadlineExceededError";
  }
}

let shutdownController = new AbortController();

/** Aborts every in-flight job so SIGTERM does not wait for a campaign/export. */
export function abortBackgroundJobsOnShutdown(reason: unknown = "Worker shutting down"): void {
  if (!shutdownController.signal.aborted) shutdownController.abort(reason);
}

/** Signal passed to the generic worker so shutdown reaches the runner. */
export function backgroundJobShutdownSignal(): AbortSignal {
  return shutdownController.signal;
}

/** Test helper — a previous test's shutdown must not poison the next one. */
export function resetBackgroundJobShutdownForTests(): void {
  shutdownController = new AbortController();
}

export interface JobDeadline {
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
  /** Message to persist when the deadline/shutdown fired, or null for a real failure. */
  reasonMessage(): string | null;
  dispose(): void;
}

/**
 * Combines the caller's signal, the process shutdown signal and a per-kind
 * wall clock. The timeout controller is aborted on expiry so runners that
 * observe `ctx.signal` stop sending/uploading promptly.
 */
export function createJobDeadline(
  moduleId: string,
  kind: string,
  externalSignal?: AbortSignal,
): JobDeadline {
  const timeoutMs = resolveJobExecutionTimeoutMs(moduleId, kind);
  const timeoutController = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    timeoutController.abort(new JobDeadlineExceededError(timeoutMs));
  }, timeoutMs);
  timer.unref?.();

  const signals = [timeoutController.signal, shutdownController.signal];
  if (externalSignal) signals.push(externalSignal);

  return {
    signal: AbortSignal.any(signals),
    timeoutMs,
    reasonMessage: () => {
      if (timedOut) return new JobDeadlineExceededError(timeoutMs).message;
      if (shutdownController.signal.aborted) return "Worker is shutting down";
      return null;
    },
    dispose: () => clearTimeout(timer),
  };
}

/**
 * Races `work` against the deadline. On abort, waits up to five seconds for the
 * runner to observe the signal (same contract as the sandboxed processors) so a
 * BullMQ retry cannot overlap work that is still unwinding.
 */
export async function runWithJobDeadline<T>(
  deadline: JobDeadline,
  work: () => Promise<T>,
): Promise<T> {
  const workPromise = work();
  let onAbort: (() => void) | undefined;

  try {
    const result = await Promise.race([
      workPromise,
      new Promise<never>((_, reject) => {
        onAbort = () => reject(new Error(deadline.reasonMessage() ?? "Background job aborted"));
        if (deadline.signal.aborted) {
          onAbort();
          return;
        }
        deadline.signal.addEventListener("abort", onAbort, { once: true });
      }),
    ]);
    // A runner may resolve while observing the abort; the deadline still wins,
    // otherwise the job would be recorded as completed during shutdown.
    if (deadline.signal.aborted) {
      throw new Error(deadline.reasonMessage() ?? "Background job aborted");
    }
    return result;
  } catch (error) {
    if (deadline.signal.aborted) await settleInFlight(workPromise, 5_000);
    throw error;
  } finally {
    if (onAbort) deadline.signal.removeEventListener("abort", onAbort);
  }
}
