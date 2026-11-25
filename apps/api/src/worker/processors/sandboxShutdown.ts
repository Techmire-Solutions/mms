import { abortBackgroundJobsOnShutdown } from "../../services/backgroundJobDeadline.js";

let installed = false;
const handlers = new Map<string, () => void>();

/**
 * Installs SIGTERM/SIGINT handling in a sandboxed child process.
 *
 * The child has its own module instance and its own shutdown controller, so the parent's
 * `abortBackgroundJobsOnShutdown()` does not reach it. The BullMQ child pool sends SIGTERM when the
 * worker force-closes; this handler aborts the runner's deadline (the next page/chunk check throws,
 * the in-flight chunk transaction rolls back) instead of letting the job run until SIGKILL.
 */
export function installSandboxShutdownAbort(): void {
  if (installed) return;
  installed = true;
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    const handler = () => abortBackgroundJobsOnShutdown(signal);
    handlers.set(signal, handler);
    process.on(signal, handler);
  }
}

/** Test helper: a previous test's handler must not leak into the next process-level test. */
export function resetSandboxShutdownAbortForTests(): void {
  for (const [signal, handler] of handlers.entries()) {
    process.removeListener(signal, handler);
  }
  handlers.clear();
  installed = false;
}
