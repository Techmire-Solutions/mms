import { describe, expect, it } from "vitest";
import type { JournalEntry } from "@/lib/data/accountingData";
import {
  getJournalBalanceDifference,
  getJournalEntryLineTotals,
  getJournalTagLabel,
  isJournalBalanced,
} from "./journalEntriesListShared";

const entry = (
  lines: JournalEntry["lines"],
  status: JournalEntry["status"] = "posted",
): JournalEntry => ({
  id: "je-1",
  ref: "JE-0001",
  date: "2026-09-01",
  description: "Entry",
  status,
  created_by: "u1",
  fiscal_year: "2026",
  tags: [],
  attachments: [],
  lines,
});

const line = (account_id: string, debit: number, credit: number) => ({
  id: `l-${account_id}-${debit}-${credit}`,
  account_id,
  debit,
  credit,
  description: "",
});

describe("getJournalEntryLineTotals", () => {
  it("rounds float-hostile line sums to exact money for the CSV export", () => {
    const totals = getJournalEntryLineTotals(
      entry([line("a-cash", 0.1, 0), line("a-cash", 0.2, 0), line("a-income", 0, 0.3)]),
    );
    expect(String(totals.totalDebit)).toBe("0.3");
    expect(String(totals.totalCredit)).toBe("0.3");
    expect(totals.totalDebit).not.toBe(0.30000000000000004);
  });

  it("keeps large two-decimal sums exact", () => {
    const totals = getJournalEntryLineTotals(
      entry([line("a-cash", 1234567.89, 0), line("a-cash", 0.11, 0), line("a-income", 0, 1234568)]),
    );
    expect(String(totals.totalDebit)).toBe("1234568");
    expect(String(totals.totalCredit)).toBe("1234568");
  });
});

describe("footer balance semantics", () => {
  it("compares the rows shown in integer cents", () => {
    expect(isJournalBalanced(0.3, 0.3)).toBe(true);
    // Float drift from summing 0.1 + 0.2 is not a real difference.
    expect(isJournalBalanced(0.30000000000000004, 0.3)).toBe(true);
    // A real one-cent difference is.
    expect(isJournalBalanced(0.31, 0.3)).toBe(false);
    expect(isJournalBalanced(0.1, 0.2)).toBe(false);
    // An empty page is not reported as an imbalance.
    expect(isJournalBalanced(0, 0)).toBe(true);
  });

  it("reports the difference in exact money", () => {
    const formatAmount = (amount: number) => amount.toFixed(2);
    expect(getJournalBalanceDifference(0.30000000000000004, 0.3, formatAmount)).toBe("0.00");
    expect(getJournalBalanceDifference(1.1, 1, formatAmount)).toBe("0.10");
  });
});

describe("getJournalTagLabel", () => {
  it("translates known tags and preserves custom tags directly", () => {
    const mockT = ((key: string) => `translated:${key}`) as any;
    expect(getJournalTagLabel("Payroll", mockT)).toBe("translated:accounting.journal.tag.payroll");
    expect(getJournalTagLabel("payroll", mockT)).toBe("translated:accounting.journal.tag.payroll");
    expect(getJournalTagLabel("CustomProject", mockT)).toBe("CustomProject");
    expect(getJournalTagLabel("Fundraiser-2026", mockT)).toBe("Fundraiser-2026");
  });
});
