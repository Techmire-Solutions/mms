import { describe, expect, it } from "vitest";
import type { Payment } from "@mms/shared";
import {
  assertPaymentLedgerFieldsUnchanged,
  paymentLedgerSensitiveChanges,
} from "../finance/use-cases/financePaymentEditGuards.js";

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    invoiceId: "inv-1",
    studentId: "stu-1",
    studentName: "Ahmad",
    amount: 100,
    date: "2026-01-15",
    method: "cash",
    note: "",
    currency: "PKR",
    exchangeRate: "1",
    invoiceAmount: 100,
    allocations: [{ id: "pa-1", invoiceId: "inv-1", amount: 100 }],
    ...overrides,
  } as Payment;
}

describe("payment ledger edit guard", () => {
  it("treats an echoed payload as unchanged", () => {
    expect(
      paymentLedgerSensitiveChanges(payment(), {
        amount: 100,
        invoiceId: "inv-1",
        date: "2026-01-15",
        currency: "PKR",
        exchangeRate: "1",
        allocations: [{ id: "pa-1", invoiceId: "inv-1", amount: 100 }],
      }),
    ).toEqual([]);
  });

  it("lists every ledger-sensitive field that changed", () => {
    expect(
      paymentLedgerSensitiveChanges(payment(), {
        amount: 999,
        invoiceId: "inv-2",
        date: "2026-02-01",
        exchangeRate: "2",
        allocations: [{ id: "pa-1", invoiceId: "inv-1", amount: 40 }],
      }),
    ).toEqual(["amount", "invoiceId", "date", "exchangeRate", "allocations"]);
  });

  it("allows metadata-only edits on a posted payment", () => {
    expect(() =>
      assertPaymentLedgerFieldsUnchanged(payment(), { note: "bank transfer" }, true),
    ).not.toThrow();
  });

  it("rejects financial edits on a posted payment but allows them on a draft", () => {
    expect(() => assertPaymentLedgerFieldsUnchanged(payment(), { amount: 1 }, true)).toThrow(
      /archive it and re-enter/,
    );
    expect(() => assertPaymentLedgerFieldsUnchanged(payment(), { amount: 1 }, false)).not.toThrow();
  });

  it("ignores allocation order and compares amounts in cents", () => {
    const twoAllocations = payment({
      allocations: [
        { id: "pa-2", invoiceId: "inv-1", amount: 60 },
        { id: "pa-1", invoiceId: "inv-1", amount: 40 },
      ],
    });

    expect(
      paymentLedgerSensitiveChanges(twoAllocations, {
        allocations: [
          { id: "pa-1", invoiceId: "inv-1", amount: 40 },
          { id: "pa-2", invoiceId: "inv-1", amount: 60 },
        ],
      }),
    ).toEqual([]);
  });
});
