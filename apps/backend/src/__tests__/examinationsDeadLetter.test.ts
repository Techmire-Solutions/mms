import { describe, expect, it, vi } from "vitest";

/**
 * A permanently failed examinations job must leave a trace in the audit chain.
 *
 * Kept in its own file for the same reason as the Hasanat test: `worker/queues/index.ts`
 * participates in a circular import, so `deadLetter` is imported directly.
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

import { QUEUE_BULK_EXPORT } from "../worker/queues/queueConfig.js";
import { handleDeadLetterJob } from "../worker/queues/deadLetter.js";

describe("examinations dead-letter handling", () => {
  it("records an examination audit row when an import exhausts retries", async () => {
    auditSpy.mockClear();
    failedSpy.mockClear();

    await handleDeadLetterJob(
      QUEUE_BULK_EXPORT,
      {
        jobId: "job-ex-1",
        tenantId: "demo",
        userId: "u1",
        moduleId: "examinations",
        kind: "import",
        label: "Importing exams",
        payload: {},
        enqueuedAt: new Date().toISOString(),
      },
      "payload rejected",
    );

    expect(failedSpy).toHaveBeenCalledWith(
      "demo",
      "u1",
      "job-ex-1",
      "examinations",
      "import",
      expect.stringContaining("payload rejected"),
    );
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "demo",
        tableName: "exams",
        recordId: "job-ex-1",
        actionType: "UPDATE",
        realUserId: "u1",
        newState: expect.objectContaining({
          tag: "examinations.job.dead_letter",
          kind: "import",
          reasonCode: "job_dead_letter",
        }),
      }),
    );
  });
});
