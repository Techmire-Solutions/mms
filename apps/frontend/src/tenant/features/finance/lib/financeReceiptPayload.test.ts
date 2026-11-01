import { describe, expect, it } from "vitest";
import type { Invoice } from "@/lib/data/financeData";
import { buildFinanceReceiptPayload } from "./financeReceiptPayload";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    studentId: "stu-1",
    studentName: "Zaid Khan",
    class: "Class 1",
    session: "Morning",
    baseFee: 500,
    discountValue: 0,
    discountAmt: 0,
    finalAmt: 500,
    status: "paid",
    dueDate: "2026-01-01",
    paidDate: "2026-01-02",
    method: "Cash",
    invoiceNumber: "INV-100",
    lines: [{ id: "line-1", description: "Tuition", quantity: 1, amount: 500, discountAmt: 0 }],
    ...overrides,
  } as Invoice;
}

describe("buildFinanceReceiptPayload", () => {
  it("maps a paid invoice, its lines, and the collected balance", () => {
    const payload = buildFinanceReceiptPayload(invoice(), "Madrasa Al-Huda");

    expect(payload).toMatchObject({
      institution: "Madrasa Al-Huda",
      receiptNo: "INV-100",
      date: "2026-01-02",
      studentName: "Zaid Khan",
      rollNo: "stu-1",
      className: "Class 1 · Morning",
      totalAmount: "500",
      paidAmount: "500",
      balance: "0",
      paymentMethod: "Cash",
      transactionRef: "INV-100",
    });
    expect(payload.feeItems).toEqual([{ description: "Tuition", amount: "500", paid: "500" }]);
  });

  it("does not claim a line was paid on a partial invoice", () => {
    const payload = buildFinanceReceiptPayload(
      invoice({ status: "partial", paidAmt: 200 }),
      "Madrasa",
    );

    expect(payload.feeItems[0]?.paid).toBe("");
    expect(payload.paidAmount).toBe("200");
    expect(payload.balance).toBe("300");
  });

  it("falls back to a single row when the invoice has no lines", () => {
    const payload = buildFinanceReceiptPayload(invoice({ lines: undefined }), "Madrasa");

    expect(payload.feeItems).toHaveLength(1);
    expect(payload.feeItems[0]?.amount).toBe("500");
  });
});
