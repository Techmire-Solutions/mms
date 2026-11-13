import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnqueue = vi.fn();
const mockGetJob = vi.fn();
const mockEnqueueCsv = vi.fn();
const mockAudit = vi.fn();

vi.mock("../services/backgroundJobWorkerService.js", () => ({
  enqueueBackgroundJob: (...args: unknown[]) => mockEnqueue(...args),
  getUserBackgroundJob: (...args: unknown[]) => mockGetJob(...args),
  QueueUnavailableError: class QueueUnavailableError extends Error {},
}));

vi.mock("../lib/csvExportEnqueue.js", () => ({
  enqueueCsvExportJob: (...args: unknown[]) => mockEnqueueCsv(...args),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: (...args: unknown[]) => mockAudit(...args),
}));

import {
  enqueueAccountingLedgerExport,
  enqueueAccountingReportPdf,
} from "../routes/tenant/accounting/accountingReportDocumentEnqueue.js";

const JOB = {
  id: "demo:u-1:key",
  moduleId: "accounting",
  kind: "report-pdf",
  status: "pending" as const,
  label: "Generating trial-balance PDF",
  createdAt: "2026-11-13T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetJob.mockResolvedValue(null);
  mockEnqueue.mockResolvedValue(JOB);
  mockEnqueueCsv.mockResolvedValue(JOB);
  mockAudit.mockResolvedValue(undefined);
});

describe("accounting report document enqueue", () => {
  it("creates a deterministic report-PDF job and audits the request", async () => {
    const job = await enqueueAccountingReportPdf("demo", "u-1", {
      kind: "trial-balance",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });

    expect(job).toEqual(JOB);
    expect(mockEnqueue).toHaveBeenCalledWith(
      "demo",
      "u-1",
      expect.objectContaining({ moduleId: "accounting", kind: "report-pdf" }),
      expect.objectContaining({ kind: "trial-balance" }),
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "accounting_reports",
        actionType: "VIEW",
        newState: expect.objectContaining({ action: "accounting.report.pdf" }),
      }),
    );
  });

  it("returns the stored job for an identical re-submit instead of queueing twice", async () => {
    mockGetJob.mockResolvedValueOnce(JOB);
    const job = await enqueueAccountingReportPdf("demo", "u-1", { kind: "trial-balance" });
    expect(job).toEqual(JOB);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("queues the ledger export through the CSV job path and audits it", async () => {
    const job = await enqueueAccountingLedgerExport("demo", "u-1", "accountant", {
      accountId: "acc-1",
      dateFrom: "2026-11-01",
      dateTo: "2026-11-30",
    });

    expect(job).toEqual(JOB);
    expect(mockEnqueueCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: "accounting",
        kind: "export-ledger",
        query: { accountId: "acc-1", dateFrom: "2026-11-01", dateTo: "2026-11-30" },
        viewerRole: "accountant",
        allowDeleted: false,
      }),
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        newState: expect.objectContaining({ action: "accounting.export.queue" }),
      }),
    );
  });
});
