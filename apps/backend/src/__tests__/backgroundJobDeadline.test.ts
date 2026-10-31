import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  abortBackgroundJobsOnShutdown,
  createJobDeadline,
  resetBackgroundJobShutdownForTests,
  runWithJobDeadline,
} from "../services/backgroundJobDeadline.js";
import {
  MESSAGING_JOB_TIMEOUT_MS,
  JOB_EXECUTION_TIMEOUT_MS,
  resolveJobExecutionTimeoutMs,
} from "../worker/queues/queueConfig.js";

describe("background job deadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetBackgroundJobShutdownForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses a longer budget for messaging and the sandboxed ceiling elsewhere", () => {
    expect(resolveJobExecutionTimeoutMs("messaging", "dispatch")).toBe(MESSAGING_JOB_TIMEOUT_MS);
    expect(resolveJobExecutionTimeoutMs("contacts", "export")).toBe(JOB_EXECUTION_TIMEOUT_MS);
  });

  it("aborts the runner signal when its wall clock expires", async () => {
    const deadline = createJobDeadline("contacts", "export", undefined);

    expect(deadline.signal.aborted).toBe(false);
    vi.advanceTimersByTime(JOB_EXECUTION_TIMEOUT_MS);

    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.reasonMessage()).toMatch(/60s execution budget/);
    deadline.dispose();
  });

  it("surfaces shutdown as a stable reason", () => {
    const deadline = createJobDeadline("messaging", "dispatch", undefined);

    abortBackgroundJobsOnShutdown("SIGTERM");

    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.reasonMessage()).toBe("Worker is shutting down");
    deadline.dispose();
  });

  it("waits for slow work to observe the abort before rejecting", async () => {
    const deadline = createJobDeadline("messaging", "dispatch", undefined);
    let observedAbort = false;

    const work = () =>
      new Promise<void>((resolve) => {
        deadline.signal.addEventListener(
          "abort",
          () => {
            observedAbort = true;
            resolve();
          },
          { once: true },
        );
      });

    const promise = runWithJobDeadline(deadline, work);
    abortBackgroundJobsOnShutdown("test");

    await expect(promise).rejects.toThrow(/shutting down/);
    expect(observedAbort).toBe(true);
    deadline.dispose();
  });
});
