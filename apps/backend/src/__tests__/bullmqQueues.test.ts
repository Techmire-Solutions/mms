import { describe, it, expect, vi } from "vitest";
import { logger } from "../lib/logger.js";
import {
  QUEUE_PDF_RENDERING,
  QUEUE_BULK_EXPORT,
  QUEUE_MESSAGING_BROADCAST,
  QUEUE_SESSIONS_ROLLOVER,
  QUEUE_EXAMINATIONS,
  QUEUE_SETTINGS,
  SANDBOXED_QUEUE_NAMES,
  sandboxedWorkerOptions,
  DEFAULT_JOB_OPTIONS,
  WORKER_HEAP_LIMIT_BYTES,
  resolveQueueNameForJob,
  handleDeadLetterJob,
  getQueue,
  closeAllQueues,
  dispatchJobToQueue,
} from "../worker/queues/index.js";

describe("BullMQ Queue Architecture (Phase 5)", () => {
  it("defines correct queue names and concurrencies", () => {
    // One slot per Typst process: the compiler semaphore is per sandboxed child, so the queue
    // concurrency is the global bound (each render also holds a 512 MB child heap).
    expect(QUEUE_SETTINGS[QUEUE_PDF_RENDERING]).toEqual({
      concurrency: 2,
      priority: 1,
    });
    expect(QUEUE_SETTINGS[QUEUE_BULK_EXPORT]).toEqual({
      concurrency: 2,
      priority: 2,
    });
    expect(QUEUE_SETTINGS[QUEUE_MESSAGING_BROADCAST]).toEqual({
      concurrency: 6,
      priority: 3,
    });
    expect(QUEUE_SETTINGS[QUEUE_SESSIONS_ROLLOVER]).toEqual({
      concurrency: 1,
      priority: 1,
    });
    expect(QUEUE_SETTINGS[QUEUE_EXAMINATIONS]).toEqual({
      concurrency: 2,
      priority: 2,
    });
  });

  it("configures exponential backoff retry and auto-removal retention policies", () => {
    expect(DEFAULT_JOB_OPTIONS.attempts).toBe(3);
    expect(DEFAULT_JOB_OPTIONS.backoff).toEqual({
      type: "exponential",
      delay: 1000,
    });
    expect(DEFAULT_JOB_OPTIONS.removeOnComplete).toEqual({
      count: 100,
      age: 3600,
    });
    expect(DEFAULT_JOB_OPTIONS.removeOnFail).toEqual({
      count: 500,
      age: 86400,
    });
    expect(WORKER_HEAP_LIMIT_BYTES).toBeGreaterThanOrEqual(128 * 1024 * 1024);
  });

  it("correctly resolves queue names based on module and kind", () => {
    // PDF rendering jobs
    expect(resolveQueueNameForJob("students", "export-pdf")).toBe(QUEUE_PDF_RENDERING);
    expect(resolveQueueNameForJob("examination", "generate-report-card")).toBe(QUEUE_PDF_RENDERING);
    expect(resolveQueueNameForJob("finance", "fee-receipt-pdf")).toBe(QUEUE_PDF_RENDERING);

    // Messaging broadcast jobs
    expect(resolveQueueNameForJob("messaging", "send-campaign")).toBe(QUEUE_MESSAGING_BROADCAST);
    expect(resolveQueueNameForJob("notifications", "broadcast-sms")).toBe(
      QUEUE_MESSAGING_BROADCAST,
    );
    expect(resolveQueueNameForJob("contacts", "whatsapp-broadcast")).toBe(
      QUEUE_MESSAGING_BROADCAST,
    );

    // Bulk export / default jobs
    expect(resolveQueueNameForJob("contacts", "export-csv")).toBe(QUEUE_BULK_EXPORT);
    expect(resolveQueueNameForJob("contacts", "export-vcf")).toBe(QUEUE_BULK_EXPORT);
    expect(resolveQueueNameForJob("contacts", "duplicate-scan")).toBe(QUEUE_BULK_EXPORT);
    expect(resolveQueueNameForJob("users", "export-csv")).toBe(QUEUE_BULK_EXPORT);
    // Long-running session rollover gets its own queue so exports/imports are not starved.
    expect(resolveQueueNameForJob("sessions", "promote")).toBe(QUEUE_SESSIONS_ROLLOVER);

    // Examinations work (marks imports, broadsheet/exam CSV exports) has its own queue.
    expect(resolveQueueNameForJob("examinations", "marks-import")).toBe(QUEUE_EXAMINATIONS);
    expect(resolveQueueNameForJob("examinations", "results-export")).toBe(QUEUE_EXAMINATIONS);
    expect(resolveQueueNameForJob("examinations", "export")).toBe(QUEUE_EXAMINATIONS);
    expect(resolveQueueNameForJob("examinations", "import")).toBe(QUEUE_EXAMINATIONS);
  });

  it("applies a restart-tolerant stall policy to the sandboxed workers", () => {
    expect(sandboxedWorkerOptions()).toEqual({
      lockDuration: 60_000,
      maxStalledCount: 3,
      stalledInterval: 30_000,
    });
    expect(SANDBOXED_QUEUE_NAMES).toEqual(
      expect.arrayContaining([QUEUE_PDF_RENDERING, QUEUE_BULK_EXPORT, QUEUE_EXAMINATIONS]),
    );
  });

  it("handles dead-letter queue permanently failed jobs gracefully", async () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation((() => {}) as any);

    await handleDeadLetterJob(
      QUEUE_BULK_EXPORT,
      {
        jobId: "test-job-999",
        tenantId: "alpha",
        userId: "user-1",
        moduleId: "contacts",
        kind: "export-csv",
        payload: {},
        enqueuedAt: new Date().toISOString(),
      },
      "Rate limit exceeded / timeout after 3 attempts",
    );

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "test-job-999", queue: QUEUE_BULK_EXPORT }),
      "Job permanently failed in queue",
    );

    errorSpy.mockRestore();
  });

  it("allows creating queues and closing them cleanly", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const queue = getQueue(QUEUE_BULK_EXPORT);
    expect(queue).toBeDefined();
    expect(queue.name).toBe(QUEUE_BULK_EXPORT);

    await closeAllQueues();
    logSpy.mockRestore();
  });

  it("returns false when queue dispatch fails or times out", async () => {
    const queue = getQueue(QUEUE_BULK_EXPORT);
    vi.spyOn(queue, "add").mockRejectedValueOnce(new Error("Redis connection refused"));
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation((() => {}) as any);

    const result = await dispatchJobToQueue(
      "alpha",
      "user-1",
      {
        id: "job-err-1",
        moduleId: "contacts",
        kind: "export",
        label: "Export Contacts",
        status: "pending",
        createdAt: new Date().toISOString(),
      },
      {},
    );

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-err-1", queue: QUEUE_BULK_EXPORT }),
      "Failed to enqueue job",
    );
    warnSpy.mockRestore();
  });
});
