import { describe, expect, it } from "vitest";
import type { PaymentAllocation } from "./financeBilling.js";
import {
  paymentAllocationViolations,
  type PaymentAllocationCheckInput,
} from "./financePaymentAllocations.js";

function allocation(overrides: Partial<PaymentAllocation> = {}): PaymentAllocation {
  return {
    id: "alloc-1",
    invoiceId: "inv-1",
    amount: 100,
    ...overrides,
  };
}

function check(overrides: Partial<PaymentAllocationCheckInput> = {}) {
  return paymentAllocationViolations({
    paymentInvoiceId: "inv-1",
    appliedAmount: 100,
    allocations: [allocation()],
    ...overrides,
  });
}

describe("paymentAllocationViolations", () => {
  it("accepts a single allocation that matches the applied amount", () => {
    expect(check()).toEqual([]);
  });

  it("accepts no allocations at all (the caller synthesises the default row)", () => {
    expect(check({ allocations: [] })).toEqual([]);
  });

  it("accepts a split that still sums to the applied amount", () => {
    expect(
      check({
        appliedAmount: 100,
        allocations: [allocation({ id: "a", amount: 60 }), allocation({ id: "b", amount: 40 })],
      }),
    ).toEqual([]);
  });

  it("rejects a total that does not match the applied amount", () => {
    expect(check({ appliedAmount: 100, allocations: [allocation({ amount: 500 })] })).toEqual([
      "allocation_total_mismatch",
    ]);
    // …including a one-cent mismatch, which is the drift this guards against.
    expect(check({ appliedAmount: 100, allocations: [allocation({ amount: 100.01 })] })).toEqual([
      "allocation_total_mismatch",
    ]);
  });

  it("rejects an allocation that targets another invoice", () => {
    // createPayment only updates the payment's own invoice, so a second invoice's allocation
    // would be recorded against a balance that never moved.
    expect(check({ allocations: [allocation({ invoiceId: "inv-2" })] })).toEqual([
      "allocation_foreign_invoice",
    ]);
  });

  it("allows foreign invoices when the caller says the settlement supports them", () => {
    expect(
      check({ allocations: [allocation({ invoiceId: "inv-2" })], allowMultipleInvoices: true }),
    ).toEqual([]);
  });

  it("rejects line-level allocation, which nothing reads and nothing validates", () => {
    expect(check({ allocations: [allocation({ invoiceLineId: "line-1" })] })).toEqual([
      "allocation_line_unsupported",
    ]);
    // An empty line id is not line-level allocation.
    expect(check({ allocations: [allocation({ invoiceLineId: "  " })] })).toEqual([]);
  });

  it("reports every violation it finds", () => {
    expect(
      check({
        appliedAmount: 100,
        allocations: [allocation({ invoiceId: "inv-2", amount: 40, invoiceLineId: "line-1" })],
      }),
    ).toEqual([
      "allocation_total_mismatch",
      "allocation_foreign_invoice",
      "allocation_line_unsupported",
    ]);
  });

  it("compares in integer cents, not floats", () => {
    // 33.33 + 33.33 + 33.34 sums to 100 only in cents.
    expect(
      check({
        appliedAmount: 100,
        allocations: [
          allocation({ id: "a", amount: 33.33 }),
          allocation({ id: "b", amount: 33.33 }),
          allocation({ id: "c", amount: 33.34 }),
        ],
      }),
    ).toEqual([]);
  });
});
