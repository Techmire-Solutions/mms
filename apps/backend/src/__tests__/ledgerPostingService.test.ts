import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAccountingRepo = vi.hoisted(() => ({
  bulkSaveEntries: vi.fn(),
  findEntryById: vi.fn(),
  findEntryIdBySource: vi.fn(),
  saveEntry: vi.fn(),
}));

const mockLedgerOpsRepo = vi.hoisted(() => ({
  getPostingRules: vi.fn(),
}));

const mockFiscalYearsRepo = vi.hoisted(() => ({
  listFiscalYearsByWorkspace: vi.fn(),
}));

vi.mock("../db/repositories/accountingRepository.js", () => mockAccountingRepo);
vi.mock("../db/repositories/accountingLedgerOpsRepository.js", () => mockLedgerOpsRepo);
vi.mock("../db/repositories/accountingFiscalYearsRepository.js", () => mockFiscalYearsRepo);

import {
  tryPostInvoiceJournal,
  tryPostPaymentJournal,
  tryPostOpeningJournal,
  tryPostInvoiceReversalJournal,
  tryPostLateFeeJournals,
  tryPostLateFeeReversalJournal,
  tryPostCreditNoteJournal,
} from "../accounting/ledgerPosting/ledgerPostingService.js";

const OPEN_YEAR = {
  id: "fy-1",
  label: "2026",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  status: "active",
};
/** A year whose range covers any "today", so system postings hit the period lock. */
const CLOSED_ALL_TIME = {
  id: "fy-closed",
  label: "closed",
  startDate: "2000-01-01",
  endDate: "2099-12-31",
  status: "closed",
};

/**
 * Asserts the stored entry is a property that actually matters: a posted,
 * balanced, two-or-more-line entry. The previous suite asserted only
 * `ref`/`source_type`/`source_id`, so a service that swapped Dr and Cr — or
 * emitted an unbalanced entry — still passed.
 */
function expectBalancedPostedEntry(entry: {
  status?: string;
  lines?: { debit: number; credit: number }[];
}): void {
  expect(entry.status).toBe("posted");
  expect(entry.lines?.length).toBeGreaterThanOrEqual(2);
  const debit = (entry.lines ?? []).reduce((sum, line) => sum + Math.round(line.debit * 100), 0);
  const credit = (entry.lines ?? []).reduce((sum, line) => sum + Math.round(line.credit * 100), 0);
  expect(debit).toBe(credit);
  expect(debit).toBeGreaterThan(0);
}

/** The entry handed to `saveEntry` on its most recent call. */
function lastSavedEntry(): any {
  const call = mockAccountingRepo.saveEntry.mock.calls.at(-1);
  expect(call).toBeDefined();
  return call?.[1];
}

describe("ledgerPostingService", () => {
  const fiscalYears = [OPEN_YEAR];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFiscalYearsRepo.listFiscalYearsByWorkspace.mockResolvedValue(fiscalYears);
    mockAccountingRepo.findEntryIdBySource.mockResolvedValue(null);
    mockAccountingRepo.saveEntry.mockResolvedValue(undefined);
  });

  it("tryPostInvoiceJournal posts a balanced Dr AR / Cr Income entry", async () => {
    mockLedgerOpsRepo.getPostingRules.mockResolvedValue({
      arAccountId: "acc-ar",
      incomeAccountId: "acc-inc",
    });

    const invoice = {
      id: "inv-1",
      invoiceNumber: "INV-2026-0001",
      status: "pending",
      dueDate: "2026-06-01",
      finalAmt: 500,
      discountAmt: 0,
    } as any;

    await tryPostInvoiceJournal("tenant-1", invoice);

    const entry = lastSavedEntry();
    expect(entry).toMatchObject({
      ref: "invoice:inv-1",
      source_type: "invoice",
      source_id: "inv-1",
      fiscal_year_id: "fy-1",
    });
    expectBalancedPostedEntry(entry);
    expect(entry.lines).toEqual([
      expect.objectContaining({ account_id: "acc-ar", debit: 500, credit: 0 }),
      expect.objectContaining({ account_id: "acc-inc", debit: 0, credit: 500 }),
    ]);
  });

  it("tryPostInvoiceJournal splits a discount across three balanced lines", async () => {
    mockLedgerOpsRepo.getPostingRules.mockResolvedValue({
      arAccountId: "acc-ar",
      incomeAccountId: "acc-inc",
      discountAccountId: "acc-disc",
    });

    await tryPostInvoiceJournal("tenant-1", {
      id: "inv-2",
      status: "pending",
      dueDate: "2026-06-01",
      finalAmt: 90,
      discountAmt: 10,
    } as any);

    const entry = lastSavedEntry();
    expectBalancedPostedEntry(entry);
    expect(entry.lines).toEqual([
      expect.objectContaining({ account_id: "acc-ar", debit: 90, credit: 0 }),
      expect.objectContaining({ account_id: "acc-disc", debit: 10, credit: 0 }),
      expect.objectContaining({ account_id: "acc-inc", debit: 0, credit: 100 }),
    ]);
  });

  it("tryPostInvoiceJournal skips cancelled invoices", async () => {
    const invoice = { id: "inv-1", status: "cancelled", finalAmt: 100 } as any;
    await tryPostInvoiceJournal("tenant-1", invoice);
    expect(mockAccountingRepo.saveEntry).not.toHaveBeenCalled();
  });

  it("tryPostPaymentJournal posts a balanced Dr Cash / Cr AR entry", async () => {
    mockLedgerOpsRepo.getPostingRules.mockResolvedValue({
      cashAccountId: "acc-cash",
      arAccountId: "acc-ar",
    });

    const payment = {
      id: "pmt-1",
      date: "2026-06-05",
      amount: 500,
      note: "Payment for invoice",
    } as any;

    await tryPostPaymentJournal("tenant-1", payment);

    const entry = lastSavedEntry();
    expect(entry).toMatchObject({
      ref: "payment:pmt-1",
      source_type: "payment",
      source_id: "pmt-1",
    });
    expectBalancedPostedEntry(entry);
    expect(entry.lines).toEqual([
      expect.objectContaining({ account_id: "acc-cash", debit: 500, credit: 0 }),
      expect.objectContaining({ account_id: "acc-ar", debit: 0, credit: 500 }),
    ]);
  });

  it("skips posting entirely when a source already has an entry (idempotency)", async () => {
    mockLedgerOpsRepo.getPostingRules.mockResolvedValue({
      cashAccountId: "acc-cash",
      arAccountId: "acc-ar",
    });
    mockAccountingRepo.findEntryIdBySource.mockResolvedValue("je-existing");

    await tryPostPaymentJournal("tenant-1", {
      id: "pmt-1",
      date: "2026-06-05",
      amount: 500,
    } as any);

    expect(mockAccountingRepo.saveEntry).not.toHaveBeenCalled();
  });

  /**
   * In-memory stand-in for accounting_entries: the source-pair lookup sees
   * exactly what saveEntry stored, so calling a tryPost* function twice
   * exercises the real idempotency short-circuit rather than hand-tuned stubs.
   */
  function fakePostedEntryStore() {
    const posted = new Map<string, any>();
    return {
      findEntryIdBySource: async (_tenant: string, sourceType: string, sourceId: string) =>
        posted.get(`${sourceType}:${sourceId}`)?.id ?? null,
      findEntryById: async (_tenant: string, id: string) =>
        [...posted.values()].find((entry) => entry.id === id) ?? null,
      saveEntry: async (_tenant: string, entry: any) => {
        posted.set(`${entry.source_type}:${entry.source_id}`, entry);
      },
    };
  }

  function usePostedEntryStore(store: ReturnType<typeof fakePostedEntryStore>): void {
    mockAccountingRepo.findEntryIdBySource.mockImplementation(store.findEntryIdBySource);
    mockAccountingRepo.findEntryById.mockImplementation(store.findEntryById);
    mockAccountingRepo.saveEntry.mockImplementation(store.saveEntry);
  }

  it("tryPostInvoiceJournal persists only the first of two identical submissions", async () => {
    mockLedgerOpsRepo.getPostingRules.mockResolvedValue({
      arAccountId: "acc-ar",
      incomeAccountId: "acc-inc",
    });
    usePostedEntryStore(fakePostedEntryStore());
    const invoice = {
      id: "inv-1",
      invoiceNumber: "INV-1",
      status: "pending",
      dueDate: "2026-06-01",
      finalAmt: 100,
      discountAmt: 0,
    } as any;

    await tryPostInvoiceJournal("tenant-1", invoice);
    await tryPostInvoiceJournal("tenant-1", invoice);

    expect(mockAccountingRepo.saveEntry).toHaveBeenCalledTimes(1);
  });

  it("tryPostLateFeeJournals persists only the first of two identical submissions", async () => {
    mockLedgerOpsRepo.getPostingRules.mockResolvedValue({
      arAccountId: "acc-ar",
      incomeAccountId: "acc-inc",
    });
    usePostedEntryStore(fakePostedEntryStore());
    const fees = [{ invoice: { id: "inv-1", invoiceNumber: "INV-1" } as any, amount: 25 }];

    await tryPostLateFeeJournals("tenant-1", fees);
    await tryPostLateFeeJournals("tenant-1", fees);

    expect(mockAccountingRepo.saveEntry).toHaveBeenCalledTimes(1);
  });

  it("tryPostOpeningJournal saves once and returns null when the same balances are resubmitted", async () => {
    usePostedEntryStore(fakePostedEntryStore());
    const balances = [
      { id: "ob-1", accountId: "acc-cash", debit: 1000, credit: 0 },
      { id: "ob-2", accountId: "acc-cap", debit: 0, credit: 1000 },
    ] as any;

    await expect(tryPostOpeningJournal("tenant-1", "fy-1", balances)).resolves.not.toBeNull();
    await expect(tryPostOpeningJournal("tenant-1", "fy-1", balances)).resolves.toBeNull();

    expect(mockAccountingRepo.saveEntry).toHaveBeenCalledTimes(1);
  });

  it('treats a duplicate-source unique violation as "already posted" rather than failing', async () => {
    // Two concurrent callers can both pass the pre-check; the partial unique
    // index rejects the loser, which must not surface as a 500.
    mockLedgerOpsRepo.getPostingRules.mockResolvedValue({
      cashAccountId: "acc-cash",
      arAccountId: "acc-ar",
    });
    mockAccountingRepo.saveEntry.mockRejectedValue(
      Object.assign(new Error("duplicate key"), { code: "23505" }),
    );

    await expect(
      tryPostPaymentJournal("tenant-1", { id: "pmt-1", date: "2026-06-05", amount: 500 } as any),
    ).resolves.toBeUndefined();
    // The 23505 path only matters if the insert was actually attempted.
    expect(mockAccountingRepo.saveEntry).toHaveBeenCalledTimes(1);
  });

  it("does not swallow unrelated database errors", async () => {
    mockLedgerOpsRepo.getPostingRules.mockResolvedValue({
      cashAccountId: "acc-cash",
      arAccountId: "acc-ar",
    });
    mockAccountingRepo.saveEntry.mockRejectedValue(
      Object.assign(new Error("boom"), { code: "23503" }),
    );

    await expect(
      tryPostPaymentJournal("tenant-1", { id: "pmt-1", date: "2026-06-05", amount: 500 } as any),
    ).rejects.toThrow(/boom/);
  });

  it("tryPostOpeningJournal posts a balanced opening entry", async () => {
    const balances = [
      { id: "ob-1", accountId: "acc-cash", debit: 1000, credit: 0 },
      { id: "ob-2", accountId: "acc-cap", debit: 0, credit: 1000 },
    ] as any;

    await tryPostOpeningJournal("tenant-1", "fy-1", balances);

    const entry = lastSavedEntry();
    expect(entry).toMatchObject({
      source_type: "opening",
      source_id: "fy-1",
      fiscal_year_id: "fy-1",
    });
    expectBalancedPostedEntry(entry);
  });

  it("tryPostOpeningJournal throws 404 for unknown fiscal year", async () => {
    await expect(tryPostOpeningJournal("tenant-1", "fy-unknown", [])).rejects.toThrow(
      /Fiscal year not found/,
    );
  });

  it("tryPostOpeningJournal replays unchanged balances idempotently", async () => {
    mockAccountingRepo.findEntryIdBySource.mockResolvedValue("je-opening");
    mockAccountingRepo.findEntryById.mockResolvedValue({
      id: "je-opening",
      lines: [
        { id: "ob-0", account_id: "acc-cash", debit: 1000, credit: 0 },
        { id: "ob-1", account_id: "acc-cap", debit: 0, credit: 1000 },
      ],
    });
    const balances = [
      { id: "ob-1", accountId: "acc-cash", debit: 1000, credit: 0 },
      { id: "ob-2", accountId: "acc-cap", debit: 0, credit: 1000 },
    ] as any;

    await expect(tryPostOpeningJournal("tenant-1", "fy-1", balances)).resolves.toBeNull();
    expect(mockAccountingRepo.saveEntry).not.toHaveBeenCalled();
  });

  it("tryPostOpeningJournal rejects revised balances that are already posted", async () => {
    mockAccountingRepo.findEntryIdBySource.mockResolvedValue("je-opening");
    mockAccountingRepo.findEntryById.mockResolvedValue({
      id: "je-opening",
      lines: [
        { id: "ob-0", account_id: "acc-cash", debit: 1000, credit: 0 },
        { id: "ob-1", account_id: "acc-cap", debit: 0, credit: 1000 },
      ],
    });
    const revised = [
      { id: "ob-1", accountId: "acc-cash", debit: 2500, credit: 0 },
      { id: "ob-2", accountId: "acc-cap", debit: 0, credit: 2500 },
    ] as any;

    await expect(tryPostOpeningJournal("tenant-1", "fy-1", revised)).rejects.toThrow(
      /already posted for this fiscal year/,
    );
    expect(mockAccountingRepo.saveEntry).not.toHaveBeenCalled();
  });

  it("tryPostInvoiceReversalJournal swaps debit and credit on the original lines", async () => {
    mockAccountingRepo.findEntryIdBySource.mockImplementation(async (_t, sourceType) =>
      sourceType === "invoice" ? "je-orig" : null,
    );
    mockAccountingRepo.findEntryById.mockResolvedValue({
      id: "je-orig",
      lines: [
        { id: "l1", account_id: "acc-ar", debit: 100, credit: 0, description: "Invoice" },
        { id: "l2", account_id: "acc-inc", debit: 0, credit: 100, description: "Invoice" },
      ],
    });

    const invoice = { id: "inv-1", invoiceNumber: "INV-1" } as any;
    await tryPostInvoiceReversalJournal("tenant-1", invoice);

    const entry = lastSavedEntry();
    expect(entry).toMatchObject({ source_type: "reversal", source_id: "inv-1" });
    expectBalancedPostedEntry(entry);
    // The whole point of a reversal: the sides are swapped, not copied.
    expect(entry.lines).toEqual([
      expect.objectContaining({ account_id: "acc-ar", debit: 0, credit: 100 }),
      expect.objectContaining({ account_id: "acc-inc", debit: 100, credit: 0 }),
    ]);
  });

  it("tryPostLateFeeJournals posts a balanced entry under a latefee source key", async () => {
    mockLedgerOpsRepo.getPostingRules.mockResolvedValue({
      arAccountId: "acc-ar",
      incomeAccountId: "acc-inc",
    });

    const fees = [{ invoice: { id: "inv-1", invoiceNumber: "INV-1" } as any, amount: 25 }];

    await tryPostLateFeeJournals("tenant-1", fees);

    expect(mockAccountingRepo.findEntryIdBySource).toHaveBeenCalledWith(
      "tenant-1",
      "invoice",
      "latefee:inv-1",
    );
    const entry = lastSavedEntry();
    expect(entry).toMatchObject({ source_type: "invoice", source_id: "latefee:inv-1" });
    expectBalancedPostedEntry(entry);
    expect(entry.lines).toEqual([
      expect.objectContaining({ account_id: "acc-ar", debit: 25, credit: 0 }),
      expect.objectContaining({ account_id: "acc-inc", debit: 0, credit: 25 }),
    ]);
  });

  it("tryPostLateFeeReversalJournal reverses the late-fee posting, not the invoice posting", async () => {
    mockAccountingRepo.findEntryIdBySource.mockImplementation(async (_t, sourceType, sourceId) =>
      sourceType === "invoice" && sourceId === "latefee:inv-1" ? "je-fee" : null,
    );
    mockAccountingRepo.findEntryById.mockResolvedValue({
      id: "je-fee",
      lines: [
        { id: "lf-ar", account_id: "acc-ar", debit: 25, credit: 0 },
        { id: "lf-inc", account_id: "acc-inc", debit: 0, credit: 25 },
      ],
    });

    await tryPostLateFeeReversalJournal("tenant-1", { id: "inv-1", invoiceNumber: "INV-1" } as any);

    expect(mockAccountingRepo.findEntryIdBySource).toHaveBeenCalledWith(
      "tenant-1",
      "invoice",
      "latefee:inv-1",
    );
    const entry = lastSavedEntry();
    expect(entry).toMatchObject({ source_type: "reversal", source_id: "latefee:inv-1" });
    expectBalancedPostedEntry(entry);
  });

  it("tryPostCreditNoteJournal posts a balanced Dr Income / Cr AR entry", async () => {
    mockLedgerOpsRepo.getPostingRules.mockResolvedValue({
      incomeAccountId: "acc-inc",
      arAccountId: "acc-ar",
    });

    const invoice = { id: "inv-1", invoiceNumber: "INV-1" } as any;
    await tryPostCreditNoteJournal("tenant-1", invoice, "cn-1", 50);

    const entry = lastSavedEntry();
    expect(entry).toMatchObject({ source_type: "reversal", source_id: "cn-1" });
    expectBalancedPostedEntry(entry);
    expect(entry.lines).toEqual([
      expect.objectContaining({ account_id: "acc-inc", debit: 50, credit: 0 }),
      expect.objectContaining({ account_id: "acc-ar", debit: 0, credit: 50 }),
    ]);
  });

  it("rejects a system posting dated inside a closed fiscal year", async () => {
    // Regression: the period lock used to check only the declared fiscal-year
    // reference, so a posting dated inside a closed period went through.
    mockFiscalYearsRepo.listFiscalYearsByWorkspace.mockResolvedValue([CLOSED_ALL_TIME]);
    mockLedgerOpsRepo.getPostingRules.mockResolvedValue({
      cashAccountId: "acc-cash",
      arAccountId: "acc-ar",
    });

    await expect(
      tryPostPaymentJournal("tenant-1", { id: "pmt-1", date: "2026-06-05", amount: 500 } as any),
    ).rejects.toThrow(/closed fiscal year/);
    expect(mockAccountingRepo.saveEntry).not.toHaveBeenCalled();
  });

  it("never persists an unbalanced entry even if a builder regressed", async () => {
    // A one-sided line set must be refused by the persist guard, not written.
    // The first lookup resolves the original entry; the idempotency pre-check
    // inside persistGeneratedEntry then sees no existing posting and proceeds to
    // the balance guard.
    mockAccountingRepo.findEntryById.mockResolvedValue({
      id: "je-orig",
      lines: [{ id: "l1", account_id: "acc-ar", debit: 100, credit: 0 }],
    });
    let lookups = 0;
    mockAccountingRepo.findEntryIdBySource.mockImplementation(async () =>
      lookups++ === 0 ? "je-orig" : null,
    );

    await expect(
      tryPostInvoiceReversalJournal("tenant-1", { id: "inv-1", invoiceNumber: "INV-1" } as any),
    ).rejects.toThrow(/matching debit and credit/);
    expect(mockAccountingRepo.saveEntry).not.toHaveBeenCalled();
  });
});
