import { describe, expect, it, vi } from "vitest";

/**
 * A permanently failed Hasanat job must leave a trace in the audit chain.
 *
 * Kept in its own file: `worker/queues/index.ts` participates in a circular import that prevents
 * Vitest from intercepting `deadLetter`'s service imports, so this test imports `queueConfig` and
 * `deadLetter` directly.
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

import { QUEUE_HASANAT_AWARDS } from "../worker/queues/queueConfig.js";
import { handleDeadLetterJob } from "../worker/queues/deadLetter.js";

describe("hasanat dead-letter handling", () => {
  it("records an audit row and marks the job failed", async () => {
    auditSpy.mockClear();
    failedSpy.mockClear();

    await handleDeadLetterJob(
      QUEUE_HASANAT_AWARDS,
      {
        jobId: "job-9",
        tenantId: "demo",
        userId: "u1",
        moduleId: "hasanat",
        kind: "bulk-award",
        label: "Awarding cards",
        payload: {},
        enqueuedAt: new Date().toISOString(),
      },
      "boom",
    );

    expect(failedSpy).toHaveBeenCalledWith(
      "demo",
      "u1",
      "job-9",
      "hasanat",
      "bulk-award",
      expect.stringContaining("boom"),
    );
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "demo",
        tableName: "hasanat_distributions",
        recordId: "job-9",
        actionType: "UPDATE",
        realUserId: "u1",
        newState: expect.objectContaining({ tag: "hasanat.job.dead_letter", reason: "boom" }),
      }),
    );
  });

  it("leaves non-Hasanat modules alone", async () => {
    auditSpy.mockClear();
    await handleDeadLetterJob(
      "bulk-export",
      {
        jobId: "job-10",
        tenantId: "demo",
        userId: "u1",
        moduleId: "students",
        kind: "export",
        label: "Export",
        payload: {},
        enqueuedAt: new Date().toISOString(),
      },
      "boom",
    );
    expect(auditSpy).not.toHaveBeenCalled();
  });
});
