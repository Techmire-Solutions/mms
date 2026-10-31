import { describe, expect, it } from "vitest";
import { isJournalEntryBalanced } from "./accountingLedgerInvariants.js";
import { buildReversalLines } from "./accountingLedgerPosting.js";
import {
  MissingClosingRatesError,
  buildFxRevaluationJournalLines,
  computeFxRevaluation,
  totalUnrealized,
  type ForeignMonetaryBalance,
} from "./accountingFxRevaluation.js";

const ar = (openTxn: string, carryingFunc: string): ForeignMonetaryBalance => ({
  accountId: "ar",
  accountCode: "1100",
  accountName: "Fee Receivable",
  currency: "USD",
  openTxn,
  carryingFunc,
});

describe("computeFxRevaluation", () => {
  it("given 1,000 USD AR carried at 280 and a closing rate of 283, should report a 3,000 PKR gain", () => {
    // Arrange / Act
    const [line] = computeFxRevaluation(
      [ar("1000.0000", "280000.0000")],
      new Map([["USD", "283"]]),
      "PKR",
    );

    // Assert
    expect(line).toMatchObject({
      openTxn: "1000.00",
      revaluedFunc: "283000.00",
      unrealized: "3000.00",
    });
  });

  it("given 600 USD left after a partial payment, should revalue only the remaining balance", () => {
    // Arrange / Act
    const [line] = computeFxRevaluation(
      [ar("600.0000", "168000.0000")],
      new Map([["USD", "283"]]),
      "PKR",
    );

    // Assert
    expect(line.unrealized).toBe("1800.00");
  });

  it("given a USD payable (credit balance) and a rising rate, should report a loss", () => {
    // Arrange
    const payable = { ...ar("-500.0000", "-140000.0000"), accountId: "ap" };

    // Act
    const [line] = computeFxRevaluation([payable], new Map([["USD", "283"]]), "PKR");

    // Assert
    expect(line.unrealized).toBe("-1500.00");
  });

  it("given no movement, should produce no lines", () => {
    // Arrange / Act / Assert
    expect(computeFxRevaluation([ar("1000", "280000")], new Map([["USD", "280"]]), "PKR")).toEqual(
      [],
    );
  });

  it("given a currency without a closing rate, should refuse rather than revalue at 1", () => {
    // Arrange / Act / Assert
    expect(() => computeFxRevaluation([ar("1000", "280000")], new Map(), "PKR")).toThrow(
      MissingClosingRatesError,
    );
  });
});

describe("buildFxRevaluationJournalLines", () => {
  it("given gains and losses, should post balanced functional-only adjustments and a reversal that undoes them", () => {
    // Arrange
    const lines = computeFxRevaluation(
      [ar("1000", "280000"), { ...ar("-500", "-140000"), accountId: "ap" }],
      new Map([["USD", "283"]]),
      "PKR",
    );

    // Act
    const journal = buildFxRevaluationJournalLines(lines, "fx-unreal", "PKR", "2026-12-31");
    const reversal = buildReversalLines(journal);

    // Assert
    expect(totalUnrealized(lines, "PKR")).toBe("1500.00");
    expect(journal.map((l) => [l.account_id, l.debit, l.credit, l.txn_debit])).toEqual([
      ["ar", 3000, 0, "0.00"],
      ["ap", 0, 1500, "0.00"],
      ["fx-unreal", 0, 1500, undefined],
    ]);
    expect(isJournalEntryBalanced(journal)).toBe(true);
    expect(isJournalEntryBalanced(reversal)).toBe(true);
    expect(reversal[0]).toMatchObject({ account_id: "ar", debit: 0, credit: 3000 });
  });
});
