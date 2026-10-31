import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Invoice, Payment } from "@mms/shared";

const mockLedgerPosting = vi.hoisted(() => ({
  tryPostArchiveReversalJournal: vi.fn(),
  tryPostRestoreJournal: vi.fn(),
}));

vi.mock("../accounting/ledgerPosting/ledgerPostingService.js", () => mockLedgerPosting);

const {
  onInvoicesArchived,
  onInvoicesRestored,
  onPaymentsArchived,
  onPaymentsRestored,
  readArchivedPayments,
} = await import("../finance/use-cases/financeRecordLifecycle.js");

const TENANT = "tenant-1";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    studentId: "stu-1",
    studentName: "Ahmad",
    class: "",
    session: "",
    baseFee: 100,
    discountValue: 0,
    discountAmt: 0,
    finalAmt: 100,
    status: "paid",
    dueDate: "2026-01-31",
    paidAmt: 100,
    invoiceNumber: "INV-1",
    ...overrides,
  } as Invoice;
}

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    invoiceId: "inv-1",
    amount: 100,
    date: "2026-01-15",
    method: "cash",
    note: "",
    ...overrides,
  } as Payment;
}

function repoWith(invoices: Invoice[], payments: Payment[] = []) {
  return {
    findInvoicesByIds: vi.fn(async (_tenant: string, ids: string[]) =>
      invoices.filter((row) => ids.includes(row.id)),
    ),
    findPaymentsByIds: vi.fn(async (_tenant: string, ids: string[]) =>
      payments.filter((row) => ids.includes(row.id)),
    ),
    saveInvoice: vi.fn(async () => undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("invoice archive / restore", () => {
  it("reverses the invoice and its late-fee posting when archived", async () => {
    const repo = repoWith([invoice({ deletedAt: "2026-02-01T10:00:00.000Z" })]);

    await onInvoicesArchived(repo, TENANT, ["inv-1"]);

    expect(mockLedgerPosting.tryPostArchiveReversalJournal).toHaveBeenCalledTimes(2);
    expect(mockLedgerPosting.tryPostArchiveReversalJournal).toHaveBeenCalledWith(
      TENANT,
      "invoice",
      "inv-1",
      "2026-02-01T10:00:00.000Z",
      "Archive INV-1",
    );
    // Late fees post under their own source key and would otherwise survive.
    expect(mockLedgerPosting.tryPostArchiveReversalJournal).toHaveBeenCalledWith(
      TENANT,
      "invoice",
      "latefee:inv-1",
      "2026-02-01T10:00:00.000Z",
      "Archive late fee INV-1",
    );
  });

  it("posts nothing for an invoice that was not actually archived", async () => {
    const repo = repoWith([invoice({ deletedAt: null })]);

    await onInvoicesArchived(repo, TENANT, ["inv-1"]);

    expect(mockLedgerPosting.tryPostArchiveReversalJournal).not.toHaveBeenCalled();
  });

  it("re-applies the posting on restore, keyed to the archive it undoes", async () => {
    await onInvoicesRestored(TENANT, [
      { invoice: invoice(), archivedAt: "2026-02-01T10:00:00.000Z" },
    ]);

    expect(mockLedgerPosting.tryPostRestoreJournal).toHaveBeenCalledWith(
      TENANT,
      "invoice",
      "inv-1",
      "2026-02-01T10:00:00.000Z",
      "Restore INV-1",
    );
  });
});

describe("payment archive / restore", () => {
  it("reverses the cash posting and un-collects the invoice", async () => {
    const repo = repoWith([invoice()], [payment({ deletedAt: "2026-02-01T10:00:00.000Z" })]);

    await onPaymentsArchived(repo, TENANT, ["pay-1"]);

    expect(repo.saveInvoice).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ id: "inv-1", paidAmt: 0, status: "pending" }),
    );
    expect(mockLedgerPosting.tryPostArchiveReversalJournal).toHaveBeenCalledWith(
      TENANT,
      "payment",
      "pay-1",
      "2026-02-01T10:00:00.000Z",
      "Archive payment pay-1",
    );
  });

  it("leaves a partially collected invoice as partial", async () => {
    const repo = repoWith(
      [invoice({ paidAmt: 100 })],
      [payment({ id: "pay-2", amount: 40, deletedAt: "2026-02-01T10:00:00.000Z" })],
    );

    await onPaymentsArchived(repo, TENANT, ["pay-2"]);

    expect(repo.saveInvoice).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ paidAmt: 60, status: "partial" }),
    );
  });

  it("un-collects a cross-currency payment by its invoice-currency amount", async () => {
    // 280,000 PKR settles a 1,000-unit invoice: `paidAmt` tracks the invoice
    // currency, so subtracting the cash figure would zero it incorrectly.
    const repo = repoWith(
      [invoice({ paidAmt: 100, status: "paid" })],
      [
        payment({
          amount: 280000,
          invoiceAmount: 100,
          deletedAt: "2026-02-01T10:00:00.000Z",
        } as never),
      ],
    );

    await onPaymentsArchived(repo, TENANT, ["pay-1"]);

    expect(repo.saveInvoice).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ paidAmt: 0, status: "pending" }),
    );
    expect(repo.findInvoicesByIds).toHaveBeenCalledWith(TENANT, ["inv-1"], {
      includeDeleted: true,
      forUpdate: true,
    });
  });

  it("re-collects a cross-currency payment by its invoice-currency amount", async () => {
    const repo = repoWith([invoice({ paidAmt: 0, status: "pending" })]);

    await onPaymentsRestored(repo, TENANT, [
      {
        payment: payment({ amount: 280000, invoiceAmount: 100 } as never),
        archivedAt: "2026-02-01T10:00:00.000Z",
      },
    ]);

    expect(repo.saveInvoice).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ paidAmt: 100, status: "paid" }),
    );
  });

  it("writes the invoice once when several of its payments are archived together", async () => {
    const repo = repoWith(
      [invoice({ paidAmt: 100 })],
      [
        payment({ id: "pay-1", amount: 60, deletedAt: "2026-02-01T10:00:00.000Z" }),
        payment({ id: "pay-2", amount: 40, deletedAt: "2026-02-01T10:00:00.000Z" }),
      ],
    );

    await onPaymentsArchived(repo, TENANT, ["pay-1", "pay-2"]);

    expect(repo.saveInvoice).toHaveBeenCalledTimes(1);
    expect(repo.saveInvoice).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ paidAmt: 0, status: "pending" }),
    );
  });

  it("does not revive a cancelled invoice", async () => {
    const repo = repoWith(
      [invoice({ status: "cancelled", paidAmt: 0 })],
      [payment({ deletedAt: "2026-02-01T10:00:00.000Z" })],
    );

    await onPaymentsArchived(repo, TENANT, ["pay-1"]);

    expect(repo.saveInvoice).not.toHaveBeenCalled();
  });

  it("re-collects the invoice and re-posts the cash on restore", async () => {
    const repo = repoWith([invoice({ paidAmt: 0, status: "pending" })]);

    await onPaymentsRestored(repo, TENANT, [
      { payment: payment(), archivedAt: "2026-02-01T10:00:00.000Z" },
    ]);

    expect(repo.saveInvoice).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ paidAmt: 100, status: "paid" }),
    );
    expect(mockLedgerPosting.tryPostRestoreJournal).toHaveBeenCalledWith(
      TENANT,
      "payment",
      "pay-1",
      "2026-02-01T10:00:00.000Z",
      "Restore payment pay-1",
    );
  });

  it("counts the late fee as owed when deciding whether an invoice is settled", async () => {
    const repo = repoWith([invoice({ paidAmt: 0, status: "pending", lateFeeAmt: 20 })]);

    await onPaymentsRestored(repo, TENANT, [
      { payment: payment(), archivedAt: "2026-02-01T10:00:00.000Z" },
    ]);

    // 100 collected against 120 owed is still partial, not paid.
    expect(repo.saveInvoice).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ paidAmt: 100, status: "partial" }),
    );
  });
});

describe("archived snapshots", () => {
  it("captures deletedAt before a restore clears it", async () => {
    const repo = repoWith(
      [],
      [
        payment({ id: "pay-1", deletedAt: "2026-02-01T10:00:00.000Z" }),
        payment({ id: "pay-2", deletedAt: null }),
      ],
    );

    const snapshot = await readArchivedPayments(repo, TENANT, ["pay-1", "pay-2"]);

    expect(snapshot).toEqual([expect.objectContaining({ archivedAt: "2026-02-01T10:00:00.000Z" })]);
  });
});
