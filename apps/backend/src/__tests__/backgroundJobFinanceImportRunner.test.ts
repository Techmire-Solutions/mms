import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  importBatch: undefined as
    ((rows: unknown[], ctx: Record<string, unknown>) => Promise<unknown>) | undefined,
  buildExport: undefined as
    | ((query: unknown, opts: unknown, tenant?: string, signal?: AbortSignal) => Promise<unknown>)
    | undefined,
  createInvoice: vi.fn(),
  listInvoicesPage: vi.fn(),
  findStudentsByNames: vi.fn(),
}));

vi.mock("../lib/registerModuleCsvImportJobRunner.js", () => ({
  registerModuleCsvImportJobRunner: (o: { importBatch: unknown }) => {
    h.importBatch = o.importBatch as typeof h.importBatch;
  },
}));
vi.mock("../lib/registerModuleCsvExportJobRunner.js", () => ({
  registerModuleCsvExportJobRunner: (o: { buildExport: unknown }) => {
    h.buildExport = o.buildExport as typeof h.buildExport;
  },
}));
vi.mock("../finance/use-cases/financeUseCases.js", () => ({
  financeUseCases: { createInvoice: h.createInvoice },
}));
vi.mock("../finance/repository/financeRepositoryAdapter.js", () => ({
  financeRepository: { listInvoicesPage: h.listInvoicesPage },
}));
vi.mock("../db/repositories/hasanatBatchRepository.js", () => ({
  findStudentsByNames: h.findStudentsByNames,
}));

import { registerFinanceImportJobRunner } from "../services/backgroundJobFinanceRunners.js";

const ctx = () => ({
  tenant: "demo",
  userId: "u1",
  jobId: "job-1",
  viewerRole: "admin",
  updateProgress: vi.fn().mockResolvedValue(undefined),
});

describe("finance import runner", () => {
  beforeEach(() => {
    h.createInvoice.mockReset().mockResolvedValue({});
    h.findStudentsByNames.mockReset();
  });

  it("resolves recipient names to student ids and reports unresolved rows per-row", async () => {
    registerFinanceImportJobRunner();
    h.findStudentsByNames.mockResolvedValue([{ studentId: "s1", studentName: "Ali ibn Husayn" }]);

    const result = (await h.importBatch!(
      [
        {
          invoiceNumber: "INV-1",
          recipient: "Ali ibn Husayn",
          dueDate: "2026-01-01",
          amount: "100.00",
        },
        {
          invoiceNumber: "INV-2",
          recipient: "Missing Student",
          dueDate: "2026-01-01",
          amount: "50.00",
        },
      ],
      ctx(),
    )) as { imported: number; failed: number; errors?: Array<{ row: number; reason: string }> };

    expect(result.imported).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors?.[0]).toMatchObject({
      row: 2,
      reason: expect.stringContaining("Missing Student"),
    });
    expect(h.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: "s1", invoiceNumber: "INV-1", status: "pending" }),
    );
  });
});
