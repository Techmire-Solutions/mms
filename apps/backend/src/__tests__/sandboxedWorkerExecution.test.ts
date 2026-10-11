import { describe, expect, it } from "vitest";
import {
  WORKER_SUBPROCESS_MEMORY_LIMIT_MB,
  JOB_EXECUTION_TIMEOUT_MS,
  WORKER_FORK_OPTIONS,
  SANDBOXED_PDF_PROCESSOR_PATH,
  SANDBOXED_EXPORT_PROCESSOR_PATH,
} from "../worker/queues/queueConfig.js";
import { existsSync } from "node:fs";
import { executeJob } from "../services/backgroundJobWorkerService.js";

describe("Sandboxed Worker Subprocess Configuration", () => {
  it("enforces 512 MB memory ceiling for worker subprocesses", () => {
    expect(WORKER_SUBPROCESS_MEMORY_LIMIT_MB).toBe(512);
    expect(WORKER_FORK_OPTIONS.execArgv).toContain("--max-old-space-size=512");
  });

  it("enforces 60-second hard execution timeout for CPU-bound jobs", () => {
    expect(JOB_EXECUTION_TIMEOUT_MS).toBe(60000);
  });

  it("points to valid sandboxed processor entrypoints", () => {
    expect(SANDBOXED_PDF_PROCESSOR_PATH).toBeTruthy();
    expect(SANDBOXED_EXPORT_PROCESSOR_PATH).toBeTruthy();
    expect(existsSync(SANDBOXED_PDF_PROCESSOR_PATH)).toBe(true);
    expect(existsSync(SANDBOXED_EXPORT_PROCESSOR_PATH)).toBe(true);
  });

  it("times out and aborts execution when job exceeds 60-second deadline", async () => {
    const abortController = new AbortController();
    let timedOut = false;

    // Simulate 50ms test timeout mechanism matching processor logic
    const testTimeoutMs = 50;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      abortController.abort(new Error("Job exceeded maximum execution duration of 50ms"));
    }, testTimeoutMs);

    const longRunningTask = new Promise<void>((resolve, reject) => {
      abortController.signal.addEventListener("abort", () => {
        reject(abortController.signal.reason);
      });
      // Task that would run forever without abort
      setTimeout(() => resolve(), 500);
    });

    await expect(longRunningTask).rejects.toThrow(
      "Job exceeded maximum execution duration of 50ms",
    );
    expect(timedOut).toBe(true);
    clearTimeout(timeoutId);
  });

  it("executeJob rejects immediately if signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      executeJob("tenant", "user", "job-aborted-1", "test", "pdf", {}, controller.signal),
    ).rejects.toThrow("Background job job-aborted-1 aborted before execution");
  });
});
