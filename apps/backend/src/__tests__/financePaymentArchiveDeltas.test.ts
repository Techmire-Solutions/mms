import { describe, expect, it, vi } from "vitest";
import type { Invoice, Payment } from "@mms/shared";
import {
  applyCollectedDelta,
  applyPaymentDeltas,
  invoiceTotalDue,
} from "../finance/use-cases/financePaymentArchiveDeltas.js";

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
    status: "pending",
    dueDate: "2026-01-31",
    paidAmt: 0,
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

function repoWith(invoices: Invoice[]) {
  return {
    findInvoicesByIds: vi.fn(async (_tenant: string, ids: string[]) =>
      invoices.filter((row) => ids.includes(row.id)),
    ),
    saveInvoice: vi.fn(async () => undefined),
  };
}

describe("payment archive deltas", () => {
  it("derives the amount due including late fees and credits", () => {
    expect(invoiceTotalDue(invoice({ lateFeeAmt: 20, creditedAmt: 10 }))).toBe(110);
  });

  it("re-derives collected status from the invoice-currency amount", () => {
    expect(applyCollectedDelta(invoice({ paidAmt: 100 }), -100)).toMatchObject({
      paidAmt: 0,
      status: "pending",
    });
    expect(applyCollectedDelta(invoice({ paidAmt: 60 }), 40)).toMatchObject({
      paidAmt: 100,
      status: "paid",
    });
  });

  it("uses invoiceAmount, not cash amount, for cross-currency settlements", async () => {
    const repo = repoWith([invoice({ paidAmt: 100, status: "paid" })]);

    await applyPaymentDeltas(repo, "demo", [payment({ amount: 280000, invoiceAmount: 100 })], -1);

    expect(repo.findInvoicesByIds).toHaveBeenCalledWith("demo", ["inv-1"], {
      includeDeleted: true,
      forUpdate: true,
    });
    expect(repo.saveInvoice).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ paidAmt: 0, status: "pending" }),
    );
  });

  it("skips a cancelled invoice and writes each invoice once", async () => {
    const repo = repoWith([invoice({ status: "cancelled", paidAmt: 30 })]);

    await applyPaymentDeltas(
      repo,
      "demo",
      [payment({ id: "p1", amount: 10 }), payment({ id: "p2", amount: 20 })],
      -1,
    );

    expect(repo.saveInvoice).not.toHaveBeenCalled();
  });
});
