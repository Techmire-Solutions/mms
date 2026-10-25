import { describe, expect, it } from "vitest";
import type { JournalLine } from "@mms/shared";
import {
  applyEntryCurrency,
  draftLinesFromEntry,
  entryCurrencyFromLines,
  entryRateFromLines,
  functionalPreview,
} from "./journalEntryCurrency";

const line = (overrides: Partial<JournalLine>): JournalLine => ({
  id: "l1",
  account_id: "ar",
  debit: 0,
  credit: 0,
  description: "",
  ...overrides,
});

describe("applyEntryCurrency", () => {
  it("given a USD entry, should carry transaction amounts and the functional preview", () => {
    // Arrange
    const lines = [line({ debit: 1000 }), line({ id: "l2", account_id: "inc", credit: 1000 })];

    // Act
    const [debitLine, creditLine] = applyEntryCurrency(lines, "USD", "PKR", "280.5");

    // Assert
    expect(debitLine).toMatchObject({
      txn_currency: "USD",
      txn_debit: "1000.00",
      txn_credit: "0.00",
      exchange_rate: "280.5",
      debit: 280500,
      credit: 0,
    });
    expect(creditLine).toMatchObject({ txn_credit: "1000.00", credit: 280500 });
  });

  it("given the functional currency, should drop stale FX fields so the server books at 1", () => {
    // Arrange
    const stale = line({ debit: 5, txn_currency: "USD", txn_debit: "1.00", exchange_rate: "5" });

    // Act
    const [result] = applyEntryCurrency([stale], "PKR", "PKR", "");

    // Assert
    expect(result).toEqual({ id: "l1", account_id: "ar", debit: 5, credit: 0, description: "" });
  });
});

describe("draftLinesFromEntry", () => {
  it("given a stored USD entry, should edit it in USD rather than in functional figures", () => {
    // Arrange
    const stored = [
      line({
        debit: 280000,
        txn_currency: "USD",
        txn_debit: "1000.00",
        txn_credit: "0.00",
        exchange_rate: "280",
      }),
    ];

    // Act
    const [draft] = draftLinesFromEntry(stored, "PKR");

    // Assert
    expect(draft).toMatchObject({ debit: "1000.00", credit: "" });
    expect(entryCurrencyFromLines(stored, "PKR")).toBe("USD");
    expect(entryRateFromLines(stored, "PKR")).toBe("280");
  });
});

describe("functionalPreview", () => {
  it("given no usable rate, should return null instead of assuming 1", () => {
    // Arrange / Act / Assert
    expect(functionalPreview(100, "USD", "PKR", "")).toBeNull();
    expect(functionalPreview(100, "USD", "PKR", "280")).toBe(28000);
    expect(functionalPreview(100, "PKR", "PKR", "")).toBe(100);
  });
});
