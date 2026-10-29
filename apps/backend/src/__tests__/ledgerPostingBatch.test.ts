import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Invoice } from "@mms/shared";

const mockAccountingRepo = vi.hoisted(() => ({
  bulkSaveEntries: vi.fn().mockResolvedValue(undefined),
  findEntryIdBySource: vi.fn().mockResolvedValue(null),
  saveEntry: vi.fn().mockResolvedValue(undefined),
}));
const mockLedgerOps = vi.hoisted(() => ({
  getPostingRules: vi.fn().mockResolvedValue({
    arAccountId: "acc-ar",
    incomeAccountId: "acc-income",
    discountAccountId: "acc-discount",
  }),
}));
const mockFiscalYears = vi.hoisted(() => ({
  listFiscalYearsByWorkspace: vi.fn(),
}));

vi.mock("../db/repositories/accountingRepository.js", () => mockAccountingRepo);
vi.mock("../db/repositories/accountingLedgerOpsRepository.js", () => mockLedgerOps);
vi.mock("../db/repositories/accountingFiscalYearsRepository.js", () => mockFiscalYears);
vi.mock("../db/repositories/accountingCurrencySettingsRepository.js", () => ({
  getCurrencySettings: vi.fn().mockResolvedValue({
    functionalCurrency: "PKR",
    presentationCurrency: "PKR",
    locked: true,
    enabledCurrencies: [],
  }),
}));

import { tryPostInvoiceJournals } from "../accounting/ledgerPosting/ledgerPostingService.js";

const OPEN_YEAR = {
  id: "fy-2026",
  label: "2026",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  status: "active",
};

function invoice(id: string, amount: number): Invoice {
  return {
    id,
    studentId: "s-1",
    studentName: "Student",
    class: "",
    session: "",
    baseFee: amount,
    discountValue: 0,
    discountAmt: 0,
    finalAmt: amount,
    status: "pending",
    dueDate: "2026-09-01",
  } as Invoice;
}

describe("tryPostInvoiceJournals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountingRepo.findEntryIdBySource.mockResolvedValue(null);
    mockFiscalYears.listFiscalYearsByWorkspace.mockResolvedValue([OPEN_YEAR]);
  });

  it("posts one balanced journal entry per generated invoice in a single bulk save", async () => {
    const invoices = [invoice("inv-1", 100), invoice("inv-2", 250), invoice("inv-3", 75)];

    await tryPostInvoiceJournals("tenant-1", invoices);

    expect(mockAccountingRepo.bulkSaveEntries).toHaveBeenCalledTimes(1);
    const saved = mockAccountingRepo.bulkSaveEntries.mock.calls[0]?.[1];
    expect(saved).toHaveLength(3);
    expect(saved?.map((entry: { source_id: string }) => entry.source_id)).toEqual([
      "inv-1",
      "inv-2",
      "inv-3",
    ]);
    for (const entry of saved ?? []) {
      const debit = entry.lines.reduce(
        (sum: number, line: { debit: number }) => sum + Math.round(line.debit * 100),
        0,
      );
      const credit = entry.lines.reduce(
        (sum: number, line: { credit: number }) => sum + Math.round(line.credit * 100),
        0,
      );
      expect(debit).toBe(credit);
      expect(entry.status).toBe("posted");
    }
  });

  it("skips invoices whose source posting already exists", async () => {
    mockAccountingRepo.findEntryIdBySource
      .mockResolvedValueOnce("je-invoice-inv-1")
      .mockResolvedValue(null);

    await tryPostInvoiceJournals("tenant-1", [invoice("inv-1", 100), invoice("inv-2", 250)]);

    const saved = mockAccountingRepo.bulkSaveEntries.mock.calls[0]?.[1];
    expect(saved).toHaveLength(1);
    expect(saved?.[0]?.source_id).toBe("inv-2");
  });

  it("posts nothing when posting accounts are not configured", async () => {
    mockLedgerOps.getPostingRules.mockResolvedValueOnce({});

    await tryPostInvoiceJournals("tenant-1", [invoice("inv-1", 100)]);

    expect(mockAccountingRepo.bulkSaveEntries).not.toHaveBeenCalled();
  });
});
