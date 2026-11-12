import { describe, expect, it, vi } from "vitest";

/**
 * A permanently failed workshop import/notification must leave an audit trace.
 * Kept apart because `worker/queues/index.ts` participates in a circular import.
 */
const auditSpy = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../services/auditTrailService.js", () => ({
  recordAuditEventSafely: auditSpy,
  recordModernAuditEvent: vi.fn(async () => ({ sequence: 1 })),
}));
const failedSpy = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../services/backgroundJobWorkerService.js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, markJobPermanentlyFailed: failedSpy };
});

import { QUEUE_WORKSHOPS } from "../worker/queues/queueConfig.js";
import { handleDeadLetterJob } from "../worker/queues/deadLetter.js";

describe("workshop dead-letter handling", () => {
  it("marks the job failed and writes a workshops audit row", async () => {
    auditSpy.mockClear();
    failedSpy.mockClear();
    await handleDeadLetterJob(
      QUEUE_WORKSHOPS,
      {
        jobId: "job-w1",
        tenantId: "demo",
        userId: "u1",
        moduleId: "workshops",
        kind: "import",
        label: "Importing participants",
        payload: {},
        enqueuedAt: new Date().toISOString(),
      },
      "db down",
    );

    expect(failedSpy).toHaveBeenCalledWith(
      "demo",
      "u1",
      "job-w1",
      "workshops",
      "import",
      expect.stringContaining("db down"),
    );
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "demo",
        tableName: "workshop_events",
        recordId: "job-w1",
        newState: expect.objectContaining({
          tag: "workshops.job.dead_letter",
          kind: "import",
        }),
      }),
    );
  });
});
