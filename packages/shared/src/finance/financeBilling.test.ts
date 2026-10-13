import { describe, expect, it } from "vitest";
import {
  formatInvoiceNumber,
  invoiceLineNet,
  invoiceTotalsFromLines,
  nextInvoiceNumber,
  nextInvoiceSequence,
} from "./financeBilling.js";

describe("financeBilling", () => {
  it("formats INV-{YEAR}-{SEQ} with a 4-digit sequence", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("INV-2026-0001");
    expect(formatInvoiceNumber(2026, 42)).toBe("INV-2026-0042");
  });

  it("formats invoice number according to tenant FinanceSettings", () => {
    expect(
      formatInvoiceNumber(2026, 5, {
        invoicePrefix: "BILL",
        invoiceDelimiter: "/",
        invoiceYearFormat: "YY",
        invoiceSequenceDigits: 5,
      }),
    ).toBe("BILL/26/00005");
  });

  it("increments the highest sequence for the requested year", () => {
    expect(nextInvoiceSequence(["INV-2026-0003", "INV-2025-0099", "inv-2026-0012"], 2026)).toBe(13);
    expect(nextInvoiceNumber([], 2026)).toBe("INV-2026-0001");
  });

  it("nets invoice lines and rolls them into header totals", () => {
    expect(invoiceLineNet({ quantity: 2, amount: 50, discountAmt: 10 })).toBe(90);
    expect(
      invoiceTotalsFromLines([
        { quantity: 1, amount: 100, discountAmt: 20 },
        { quantity: 2, amount: 25, discountAmt: 0 },
      ]),
    ).toEqual({ baseFee: 150, discountAmt: 20, finalAmt: 130 });
  });
});
