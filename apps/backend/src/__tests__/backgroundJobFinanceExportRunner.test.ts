import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  listInvoicesPage: vi.fn(),
}));

vi.mock("../finance/repository/financeRepositoryAdapter.js", () => ({
  financeRepository: { listInvoicesPage: h.listInvoicesPage },
}));

import { buildFinanceCsvExport } from "../services/financeExportService.js";

describe("finance export service", () => {
  beforeEach(() => {
    h.listInvoicesPage.mockReset();
  });

  it("pages invoices and serializes them through the transfer schema", async () => {
    h.listInvoicesPage.mockResolvedValueOnce({
      invoices: [
        {
          id: "inv1",
          invoiceNumber: "INV-1",
          studentName: "Ali ibn Husayn",
          finalAmt: 1500,
          dueDate: "2026-09-15",
          status: "pending",
          method: "Bank Transfer",
        },
      ],
      total: 1,
      page: 1,
      limit: 500,
      hasMore: false,
    });

    const result = await buildFinanceCsvExport(
      {},
      { viewerRole: "admin", allowDeleted: false },
      "demo",
    );

    expect(result.count).toBe(1);
    expect(result.csv).toContain("Invoice Number");
    expect(result.csv).toContain("INV-1");
    expect(result.csv).toContain("Ali ibn Husayn");
    expect(result.filename).toContain("invoices.csv");
  });
});
