import { describe, expect, it } from "vitest";
import {
  enrollmentTransferBodySchema,
  enrollmentWithdrawBodySchema,
  withdrawalInvoicePlan,
} from "./enrollmentOperations.js";
import { enrollmentHoldsSeat } from "./enrollmentsModuleManifest.js";

describe("enrollmentHoldsSeat", () => {
  it("given a live status, should hold the seat", () => {
    // Assert
    expect(enrollmentHoldsSeat("pending")).toBe(true);
    expect(enrollmentHoldsSeat("confirmed")).toBe(true);
    expect(enrollmentHoldsSeat("completed")).toBe(true);
  });

  it("given a cancelled or withdrawn enrollment, should release the seat", () => {
    // Assert
    expect(enrollmentHoldsSeat("cancelled")).toBe(false);
    expect(enrollmentHoldsSeat("withdrawn")).toBe(false);
  });
});

describe("enrollment operation bodies", () => {
  it("given a transfer with a real date and reason, should parse with an optional section", () => {
    // Act
    const parsed = enrollmentTransferBodySchema.parse({
      classId: "c2",
      effectiveOn: "2026-03-01",
      reason: "Moved to the evening batch",
    });

    // Assert
    expect(parsed).toEqual({
      classId: "c2",
      effectiveOn: "2026-03-01",
      reason: "Moved to the evening batch",
    });
  });

  it("given an impossible date, a blank reason or extra fields, should reject the body", () => {
    // Assert
    expect(
      enrollmentWithdrawBodySchema.safeParse({ effectiveOn: "2026-02-30", reason: "Moved away" })
        .success,
    ).toBe(false);
    expect(
      enrollmentWithdrawBodySchema.safeParse({ effectiveOn: "2026-02-10", reason: "  " }).success,
    ).toBe(false);
    expect(
      enrollmentWithdrawBodySchema.safeParse({
        effectiveOn: "2026-02-10",
        reason: "Moved away",
        status: "cancelled",
      }).success,
    ).toBe(false);
  });
});

describe("withdrawalInvoicePlan", () => {
  const invoice = (id: string, billingPeriod: string, extra: Record<string, unknown> = {}) => ({
    id,
    status: "pending",
    billingPeriod,
    paidAmt: 0,
    creditedAmt: 0,
    ...extra,
  });

  it("given untouched invoices after the last month, should cancel them and keep the last month", () => {
    // Act
    const plan = withdrawalInvoicePlan(
      [invoice("mar", "2026-03"), invoice("apr", "2026-04"), invoice("may", "2026-05")],
      "2026-03-17",
    );

    // Assert
    expect(plan.cancel.map((row) => row.id)).toEqual(["apr", "may"]);
    expect(plan.review).toEqual([]);
  });

  it("given paid, part-paid, credited or cancelled later invoices, should route them to review or skip them", () => {
    // Act
    const plan = withdrawalInvoicePlan(
      [
        invoice("paid", "2026-04", { status: "paid", paidAmt: 1000 }),
        invoice("partial", "2026-05", { status: "partial", paidAmt: 200 }),
        invoice("credited", "2026-06", { creditedAmt: 50 }),
        invoice("gone", "2026-07", { status: "cancelled" }),
        invoice("noPeriod", "", {}),
      ],
      "2026-03-31",
    );

    // Assert
    expect(plan.cancel).toEqual([]);
    expect(plan.review.map((row) => row.id)).toEqual(["paid", "partial", "credited"]);
  });
});
