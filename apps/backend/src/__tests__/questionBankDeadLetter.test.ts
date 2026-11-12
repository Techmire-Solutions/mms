import { describe, expect, it, vi } from "vitest";

/**
 * A permanently failed Question Bank job must leave an audit row. Kept separate from the queues
 * barrel for the same circular-import reason as the hasanat/examinations dead-letter suites.
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

import { QUEUE_QUESTION_BANK } from "../worker/queues/queueConfig.js";
import { handleDeadLetterJob } from "../worker/queues/deadLetter.js";

describe("question bank dead-letter handling", () => {
  it("records an audit row and marks the job failed", async () => {
    auditSpy.mockClear();
    failedSpy.mockClear();

    await handleDeadLetterJob(
      QUEUE_QUESTION_BANK,
      {
        jobId: "job-7",
        tenantId: "demo",
        userId: "u1",
        moduleId: "questionBank",
        kind: "import",
        label: "Importing questions",
        payload: {},
        enqueuedAt: new Date().toISOString(),
      },
      "boom",
    );

    expect(failedSpy).toHaveBeenCalledWith(
      "demo",
      "u1",
      "job-7",
      "questionBank",
      "import",
      expect.stringContaining("boom"),
    );
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "demo",
        tableName: "questions",
        recordId: "job-7",
        newState: expect.objectContaining({ tag: "questionBank.job.dead_letter", kind: "import" }),
      }),
    );
  });
});
