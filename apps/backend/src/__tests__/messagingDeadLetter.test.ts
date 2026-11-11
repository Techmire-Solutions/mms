import { describe, expect, it, vi } from "vitest";

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

import { QUEUE_MESSAGING_BROADCAST } from "../worker/queues/queueConfig.js";
import { handleDeadLetterJob } from "../worker/queues/deadLetter.js";

describe("messaging dead-letter handling", () => {
  it("records an audit event for message_logs when a broadcast job exhausts retries", async () => {
    auditSpy.mockClear();
    failedSpy.mockClear();

    await handleDeadLetterJob(
      QUEUE_MESSAGING_BROADCAST,
      {
        jobId: "job-msg-1",
        tenantId: "demo",
        userId: "u-sender-1",
        moduleId: "messaging",
        kind: "broadcast",
        label: "Emergency alert",
        payload: {},
        enqueuedAt: new Date().toISOString(),
      },
      "gateway timeout",
    );

    expect(failedSpy).toHaveBeenCalledWith(
      "demo",
      "u-sender-1",
      "job-msg-1",
      "messaging",
      "broadcast",
      expect.stringContaining("gateway timeout"),
    );
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "demo",
        tableName: "message_logs",
        recordId: "job-msg-1",
        actionType: "UPDATE",
        realUserId: "u-sender-1",
        newState: expect.objectContaining({
          tag: "messaging.job.dead_letter",
          kind: "broadcast",
          reason: "gateway timeout",
          reasonCode: "job_dead_letter",
        }),
      }),
    );
  });
});
