import { describe, expect, it } from "vitest";
import { isJournalEntryBalanced, journalEntryRecordSchema, moneyAmountSchema } from "@mms/shared";
import { parseMoneyInput } from "../lib/simpleTransactionMoney";

describe("parseMoneyInput", () => {
  it.each([
    ["1234.56", 1234.56],
    ["1,234.56", 1234.56],
    ["1234,56", 1234.56],
    ["1.234,56", 1234.56],
    ["12,50", 12.5],
    ["12.50", 12.5],
    ["0.07", 0.07],
    ["1234", 1234],
    ["0", 0],
    ["0.00", 0],
    [".5", 0.5],
    [",5", 0.5],
    ["  12.50  ", 12.5],
    ["0001234.5", 1234.5],
    ["$12", 12],
    ["$1,234.56", 1234.56],
    ["Rs. 500", 500],
    ["PKR 250", 250],
    ["1,234,567", 1234567],
    ["1.234.567,89", 1234567.89],
    ["12,345.67", 12345.67],
  ])("parses %s as %s exactly", (raw, expected) => {
    const parsed = parseMoneyInput(raw);
    expect(parsed).toBe(expected);
    expect(parsed).not.toBeNull();
    // Exact cents: the value survives the round trip the ledger uses.
    expect(Math.round((parsed as number) * 100)).toBe(Math.round(expected * 100));
    expect(moneyAmountSchema.safeParse(parsed).success).toBe(true);
  });

  it.each([
    ["", "empty"],
    ["   ", "blank"],
    ["12,50 kg", "stray text"],
    ["abc", "letters"],
    ["-5", "negative"],
    ["-0.01", "negative decimals"],
    ["+5", "leading plus"],
    ["12.345", "three decimals with dot (ambiguous)"],
    ["1,234", "ambiguous single separator with three trailing digits"],
    ["1234.567", "three decimals"],
    ["1,234.567", "three decimals after a grouped integer"],
    ["12.", "dangling separator"],
    [".", "separator only"],
    [",", "separator only"],
    ["1..5", "repeated separator inside the integer part"],
    ["1.2.3", "repeated separator short groups"],
    ["1,23,456", "group of the wrong width"],
    ["1,2345", "four trailing digits"],
    ["1e3", "exponent notation"],
    ["12 34", "thousands written with a space"],
    ["١٢٣", "non-ASCII digits"],
    ["99999999999999999", "beyond exact cents"],
  ])("refuses %s (%s)", (raw) => {
    expect(parseMoneyInput(raw)).toBeNull();
  });

  it("refuses non-string input", () => {
    expect(parseMoneyInput(null)).toBeNull();
    expect(parseMoneyInput(undefined)).toBeNull();
  });

  it("never returns NaN", () => {
    for (const raw of ["abc", "-5", "12.345", "1..5", "", "١٢٣"]) {
      const parsed = parseMoneyInput(raw);
      expect(parsed === null || Number.isFinite(parsed)).toBe(true);
    }
  });
});

describe("parsed simple-transaction amounts satisfy the ledger contract", () => {
  it("builds a balanced two-line entry the API accepts", () => {
    const amount = parseMoneyInput("1,234.56");
    expect(amount).toBe(1234.56);
    const entry = {
      id: "je-test",
      ref: "JE-TEST",
      date: "2026-01-15",
      description: "Fee collection",
      status: "posted" as const,
      created_by: "system",
      tags: ["Fees"],
      attachments: [],
      fiscal_year: "2026",
      simple_mode: true,
      transaction_type: "fee_collection",
      lines: [
        {
          id: "l-1",
          account_id: "a1000",
          debit: amount as number,
          credit: 0,
          description: "Fee collection",
        },
        {
          id: "l-2",
          account_id: "a4000",
          debit: 0,
          credit: amount as number,
          description: "Fee collection",
        },
      ],
    };
    expect(journalEntryRecordSchema.safeParse(entry).success).toBe(true);
    expect(isJournalEntryBalanced(entry.lines)).toBe(true);
  });

  it("a comma-decimal amount posts the typed value, not the parseFloat truncation", () => {
    const amount = parseMoneyInput("12,50") as number;
    expect(amount).toBe(12.5);
    expect(amount).not.toBe(12);
    expect(
      isJournalEntryBalanced([
        { debit: amount, credit: 0 },
        { debit: 0, credit: amount },
      ]),
    ).toBe(true);
  });
});
