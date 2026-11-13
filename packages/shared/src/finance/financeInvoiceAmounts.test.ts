import { describe, expect, it } from "vitest";
import { getOutstandingAmountForInvoice } from "./financeInvoiceAmounts.js";
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

  it("treats paid and cancelled invoices as settled", () => {
    expect(getOutstandingAmountForInvoice(invoice({ finalAmt: 100, status: "paid" }))).toBe(0);
    expect(getOutstandingAmountForInvoice(invoice({ finalAmt: 100, status: "cancelled" }))).toBe(0);
  });
});
