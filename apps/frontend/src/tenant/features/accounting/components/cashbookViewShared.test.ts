import { describe, expect, it } from "vitest";
import type { Account, JournalEntry, JournalLine } from "@/lib/data/accountingData";
import {
  buildCashbookFooterCells,
  buildCashbookRows,
  classifyEntry,
  countCashbookRowsByType,
  getEntryAmount,
  isCashAccount,
  resolveCashAccountIds,
  sumCashbookTotals,
} from "../lib/cashbookViewShared";

const translate = (key: string) => `t:${key}`;

/** A chart whose accounts were created in the UI (generated ids, no seed ids). */
const chart: Account[] = [
  {
    id: "a-uuid-cash",
    code: "1000",
    name: "Main Cash Box",
    type: "Asset",
    subtype: "Current Asset",
    description: "",
    isActive: true,
  },
  {
    id: "a-uuid-bank",
    code: "1010",
    name: "Meezan Current",
    type: "Asset",
    subtype: "Current Asset",
    description: "",
    isActive: true,
  },
  {
    id: "a-uuid-receivable",
    code: "1020",
    name: "Fees Receivable",
    type: "Asset",
    subtype: "Current Asset",
    description: "",
    isActive: true,
  },
  {
    id: "a-uuid-depreciation",
    code: "1090",
    name: "Accumulated Depreciation",
    type: "Asset",
    subtype: "Contra Asset",
    description: "",
    isActive: true,
  },
  {
    id: "a-uuid-income",
    code: "4000",
    name: "Tuition Income",
    type: "Revenue",
    subtype: "Operating Revenue",
    description: "",
    isActive: true,
  },
  {
    id: "a-uuid-expense",
    code: "5000",
    name: "Wages",
    type: "Expense",
    subtype: "Operating Expense",
    description: "",
    isActive: true,
  },
  {
    id: "a-uuid-capital",
    code: "3000",
    name: "Owner Capital",
    type: "Equity",
    subtype: "Owner's Equity",
    description: "",
    isActive: true,
  },
];

const CASH_IDS = resolveCashAccountIds(chart);

const line = (account_id: string, debit: number, credit: number): JournalLine => ({
  id: `l-${account_id}-${debit}-${credit}`,
  account_id,
  debit,
  credit,
  description: "",
});

const entry = (overrides: Partial<JournalEntry> & { lines: JournalLine[] }): JournalEntry => ({
  id: "je-1",
  ref: "JE-0001",
  date: "2026-09-01",
  description: "Entry",
  status: "posted",
  created_by: "u1",
  fiscal_year: "2026",
  tags: [],
  attachments: [],
  ...overrides,
});

describe("cash account resolution", () => {
  it("finds cash/bank accounts in a chart the user created in the UI", () => {
    expect(isCashAccount(chart[0]!)).toBe(true);
    expect(isCashAccount(chart[1]!)).toBe(true);
    expect(CASH_IDS).toEqual(new Set(["a-uuid-cash", "a-uuid-bank"]));
  });

  it("never treats receivables, prepaids or accumulated accounts as cash", () => {
    expect(isCashAccount(chart[2]!)).toBe(false);
    expect(isCashAccount(chart[3]!)).toBe(false);
  });

  it("always includes an explicitly configured cash account", () => {
    const ids = resolveCashAccountIds(chart, "a-uuid-income");
    expect(ids.has("a-uuid-income")).toBe(true);
    expect(ids.has("a-uuid-cash")).toBe(true);
  });
});

describe("classifyEntry with a known cash chart", () => {
  it("classifies by which side of the cash account carries the amount", () => {
    const feeCollection = entry({
      lines: [line("a-uuid-cash", 100, 0), line("a-uuid-income", 0, 100)],
      transaction_type: "fee_collection",
    });
    const wagePayment = entry({
      lines: [line("a-uuid-expense", 50, 0), line("a-uuid-cash", 0, 50)],
    });
    expect(classifyEntry(feeCollection, CASH_IDS)).toBe("in");
    expect(classifyEntry(wagePayment, CASH_IDS)).toBe("out");
    expect(getEntryAmount(feeCollection, "in", CASH_IDS)).toBe(100);
    expect(getEntryAmount(wagePayment, "out", CASH_IDS)).toBe(50);
  });

  it("classifies movements that never touch a revenue or expense line", () => {
    // A receipt settling a receivable and an owner contribution: both were
    // "transfer" while classification matched hard-coded seed ids.
    const settleReceivable = entry({
      lines: [line("a-uuid-cash", 250, 0), line("a-uuid-receivable", 0, 250)],
    });
    const ownerContribution = entry({
      lines: [line("a-uuid-bank", 1000, 0), line("a-uuid-capital", 0, 1000)],
      tags: ["Capital"],
    });
    expect(classifyEntry(settleReceivable, CASH_IDS)).toBe("in");
    expect(getEntryAmount(settleReceivable, "in", CASH_IDS)).toBe(250);
    expect(classifyEntry(ownerContribution, CASH_IDS)).toBe("in");
    expect(getEntryAmount(ownerContribution, "in", CASH_IDS)).toBe(1000);
  });

  it("reports a net-zero movement between two cash accounts as a transfer", () => {
    const cashToBank = entry({
      lines: [line("a-uuid-bank", 200, 0), line("a-uuid-cash", 0, 200)],
    });
    expect(classifyEntry(cashToBank, CASH_IDS)).toBe("transfer");
    expect(getEntryAmount(cashToBank, "transfer", CASH_IDS)).toBe(200);
  });

  it("reports an entry with no cash line as unclassified instead of guessing", () => {
    const depreciation = entry({
      lines: [line("a-uuid-expense", 75, 0), line("a-uuid-depreciation", 0, 75)],
    });
    expect(classifyEntry(depreciation, CASH_IDS)).toBe("unclassified");
    const rows = buildCashbookRows([depreciation], "", "all", translate, {
      cashAccountIds: CASH_IDS,
    });
    expect(rows[0]?.flowType).toBe("unclassified");
    expect(rows[0]?.flowLabel).toBe("t:accounting.cashbook.unclassified");
    expect(countCashbookRowsByType(rows).unclassified).toBe(1);
  });
});

describe("classifyEntry without an identifiable cash account", () => {
  it("keeps working from the entry's own transaction type and tags", () => {
    const salary = entry({
      lines: [line("a-uuid-expense", 10, 0), line("a-uuid-cash", 0, 10)],
      transaction_type: "salary",
    });
    const donation = entry({
      lines: [line("a-uuid-cash", 10, 0), line("a-uuid-income", 0, 10)],
      tags: ["Donation"],
    });
    expect(classifyEntry(salary)).toBe("out");
    expect(classifyEntry(donation)).toBe("in");
    expect(classifyEntry(salary, new Set())).toBe("out");
  });
});

describe("cashbook totals", () => {
  it("sums money in integer cents", () => {
    const rows = buildCashbookRows(
      [
        entry({
          id: "je-a",
          ref: "JE-A",
          lines: [line("a-uuid-cash", 0.1, 0), line("a-uuid-income", 0, 0.1)],
        }),
        entry({
          id: "je-b",
          ref: "JE-B",
          lines: [line("a-uuid-cash", 0.2, 0), line("a-uuid-income", 0, 0.2)],
        }),
        entry({
          id: "je-c",
          ref: "JE-C",
          lines: [line("a-uuid-expense", 0.05, 0), line("a-uuid-cash", 0, 0.05)],
        }),
      ],
      "",
      "all",
      translate,
      { cashAccountIds: CASH_IDS },
    );

    const totals = sumCashbookTotals(rows);
    expect(totals.totalInCents).toBe(30);
    expect(totals.totalOutCents).toBe(5);
    expect(totals.balanceCents).toBe(25);
    // The float sum would have been 0.30000000000000004.
    expect(totals.totalInCents / 100).toBe(0.3);
  });

  it("ignores draft rows, which no ledger view counts", () => {
    const rows = buildCashbookRows(
      [entry({ status: "draft", lines: [line("a-uuid-cash", 5, 0), line("a-uuid-income", 0, 5)] })],
      "",
      "all",
      translate,
      { cashAccountIds: CASH_IDS },
    );
    expect(rows).toHaveLength(0);
  });
});

describe("buildCashbookFooterCells", () => {
  it("spans text columns before the totals in default order", () => {
    expect(
      buildCashbookFooterCells(["date", "type", "description", "moneyIn", "moneyOut"]),
    ).toEqual([
      { kind: "label", span: 3 },
      { kind: "moneyIn", span: 1 },
      { kind: "moneyOut", span: 1 },
    ]);
  });

  it("keeps totals under their columns after reorder and hide", () => {
    expect(buildCashbookFooterCells(["moneyOut", "date", "moneyIn", "description"])).toEqual([
      { kind: "moneyOut", span: 1 },
      { kind: "label", span: 1 },
      { kind: "moneyIn", span: 1 },
      { kind: "blank", span: 1 },
    ]);
  });
});
