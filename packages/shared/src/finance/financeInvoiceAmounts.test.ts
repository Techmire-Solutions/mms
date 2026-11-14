import { describe, expect, it } from "vitest";
import {
  getCollectedAmountForMonth,
  getOutstandingAmountForInvoice,
  getOutstandingAmountForMonth,
} from "./financeInvoiceAmounts.js";
import type { Invoice } from "./financeInvoiceTypes.js";

const invoice = (overrides: Partial<Invoice>): Invoice =>
  ({
    id: "inv-1",
    studentId: "s1",
    status: "pending",
    dueDate: "2026-05-01",
    finalAmt: 0,
    baseFee: 0,
    discountValue: 0,
    discountAmt: 0,
    ...overrides,
  }) as Invoice;

describe("getOutstandingAmountForInvoice", () => {
  it("subtracts in integer cents so partial payments cannot drift a cent", () => {
    // 0.1 + 0.2 - 0.3 in binary floating point is not 0.
    const row = invoice({
      finalAmt: 0.3,
      paidAmt: 0.1,
      lateFeeAmt: 0.2,
      creditedAmt: 0,
    });
    expect(getOutstandingAmountForInvoice(row)).toBe(0.4);
  });

  it("never returns a negative balance", () => {
    expect(getOutstandingAmountForInvoice(invoice({ finalAmt: 100, paidAmt: 100.01 }))).toBe(0);
  });

  it("counts a late fee that nothing has paid — the completion gate depends on it", () => {
    // The session-completion certificate gate computes dues in SQL and must mirror this rule
    // exactly; it previously omitted `late_fee_amt`, so an enrollment owing only a late fee
    // passed the gate with zero dues (audit W5).
    const row = invoice({
      finalAmt: 100,
      paidAmt: 100,
      lateFeeAmt: 10,
      creditedAmt: 0,
      status: "partial",
    });
    expect(getOutstandingAmountForInvoice(row)).toBe(10);
  });

  it("treats paid and cancelled invoices as settled", () => {
    expect(getOutstandingAmountForInvoice(invoice({ finalAmt: 100, status: "paid" }))).toBe(0);
    expect(getOutstandingAmountForInvoice(invoice({ finalAmt: 100, status: "cancelled" }))).toBe(0);
  });
});

describe("monthly collected/outstanding totals", () => {
  it("sums 2-dp invoices in integer cents", () => {
    const may = [
      invoice({ id: "a", status: "paid", finalAmt: 0.1, paidDate: "2026-05-10" }),
      invoice({ id: "b", status: "paid", finalAmt: 0.2, paidDate: "2026-05-11" }),
      invoice({ id: "c", status: "partial", finalAmt: 10, paidAmt: 0.3, dueDate: "2026-05-12" }),
    ];
    expect(getCollectedAmountForMonth(may, 2026, 4)).toBe(0.6);
    expect(getOutstandingAmountForMonth(may, 2026, 4)).toBe(9.7);
  });
});
