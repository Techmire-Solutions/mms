import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateToIso, todayISO } from "@mms/shared";
import { computeInvoiceAmounts, createInitialDraft } from "./invoiceFormDraft";

describe("invoice form draft", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults the due date to the local calendar day, not the UTC day", () => {
    // A late-evening instant in a UTC+ zone is still the previous day in UTC; the
    // old `toISOString()` formatting produced yesterday's due date.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T23:30:00Z"));

    expect(createInitialDraft("10").dueDate).toBe(
      formatDateToIso(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)),
    );
    expect(createInitialDraft("0").dueDate).toBe(todayISO());
    expect(createInitialDraft("abc").dueDate).toBe(todayISO());
    expect(createInitialDraft("-5").dueDate).toBe(todayISO());
  });

  it("computes invoice amounts in exact cents", () => {
    expect(computeInvoiceAmounts("0.10", "0.20")).toEqual({
      baseFee: 0.1,
      discountValue: 0.2,
      discountAmt: 0.1,
      finalAmt: 0,
    });
    expect(computeInvoiceAmounts("1000", "250").finalAmt).toBe(750);
    expect(computeInvoiceAmounts("bad", "0")).toEqual({
      baseFee: 0,
      discountValue: 0,
      discountAmt: 0,
      finalAmt: 0,
    });
  });
});
