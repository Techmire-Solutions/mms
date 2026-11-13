import { afterEach, describe, expect, it } from "vitest";
import {
  backgroundJobShutdownSignal,
  resetBackgroundJobShutdownForTests,
} from "../services/backgroundJobDeadline.js";
import {
  installSandboxShutdownAbort,
  resetSandboxShutdownAbortForTests,
} from "../worker/processors/sandboxShutdown.js";

/**
 * Sandboxed processors run in forked children with their own module instance, so the parent's
 * `abortBackgroundJobsOnShutdown()` never reaches them. The child pool sends SIGTERM when the
 * worker force-closes; the handler must abort the child's runner.
 */
describe("sandboxed child shutdown", () => {
  afterEach(() => {
    resetSandboxShutdownAbortForTests();
    resetBackgroundJobShutdownForTests();
  });

  it("aborts the sandbox deadline when the child receives SIGTERM", () => {
    installSandboxShutdownAbort();
    expect(backgroundJobShutdownSignal().aborted).toBe(false);

    process.emit("SIGTERM" as never);

    expect(backgroundJobShutdownSignal().aborted).toBe(true);
  });

  it("is idempotent and does not stack duplicate listeners", () => {
    installSandboxShutdownAbort();
    installSandboxShutdownAbort();
    expect(process.listenerCount("SIGTERM")).toBe(1);
  });
});
