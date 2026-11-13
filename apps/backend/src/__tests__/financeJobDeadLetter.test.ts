import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMarkFailed = vi.fn();
vi.mock("../services/backgroundJobWorkerService.js", () => ({
  markJobPermanentlyFailed: (...args: unknown[]) => mockMarkFailed(...args),
}));

const mockAudit = vi.fn();
vi.mock("../services/auditTrailService.js", () => ({
  recordAuditEventSafely: (...args: unknown[]) => mockAudit(...args),
}));

vi.mock("../services/sessionRolloverFinalizer.js", () => ({
  failPromotionRunFromDlq: vi.fn(),
}));

vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { handleDeadLetterJob } from "../worker/queues/deadLetter.js";
import type { EnqueuedJobData } from "../worker/queues/index.js";

function job(moduleId: string, kind = "export"): EnqueuedJobData {
  return {
    jobId: "job-1",
    tenantId: "demo",
    userId: "u-1",
    moduleId,
    kind,
    label: "Finance export",
    payload: {},
    enqueuedAt: "2026-11-12T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMarkFailed.mockResolvedValue(undefined);
  mockAudit.mockResolvedValue(undefined);
});

describe("finance/accounting dead letters leave an audit trail", () => {
  it("records a finance_invoices dead-letter row for a failed finance job", async () => {
    await handleDeadLetterJob("bulk-export", job("finance"), "runner threw");

    expect(mockMarkFailed).toHaveBeenCalledWith(
      "demo",
      "u-1",
      "job-1",
      "finance",
      "export",
      expect.stringContaining("runner threw"),
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "demo",
        tableName: "finance_invoices",
        recordId: "job-1",
        actionType: "UPDATE",
        newState: expect.objectContaining({
          tag: "finance.job.dead_letter",
          kind: "export",
          reason: "runner threw",
          reasonCode: "job_dead_letter",
        }),
      }),
    );
  });

  it("records an accounting_entries dead-letter row for a failed accounting job", async () => {
    await handleDeadLetterJob("bulk-export", job("accounting"), "runner threw");

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "accounting_entries",
        newState: expect.objectContaining({ tag: "accounting.job.dead_letter" }),
      }),
    );
  });

  it("does not write a financial dead-letter row for another module", async () => {
    await handleDeadLetterJob("bulk-export", job("students"), "runner threw");
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
