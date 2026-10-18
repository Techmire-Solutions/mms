import { describe, expect, it } from "vitest";
import { moneyToCents } from "@mms/shared";
import {
  centsToMoney,
  computeFinancials,
  computeLedger,
  computeTrialBalance,
  hasReversalEntry,
  isJournalRefUnique,
  type Account,
  type JournalEntry,
} from "./accountingData";

const accounts: Account[] = [
  {
    id: "a-cash",
    code: "1000",
    name: "Cash in Hand",
    type: "Asset",
    subtype: "Current Asset",
    description: "",
    isActive: true,
  },
  {
    id: "a-income",
    code: "4000",
    name: "Tuition Income",
    type: "Revenue",
    subtype: "Operating Revenue",
    description: "",
    isActive: true,
  },
  {
    id: "a-expense",
    code: "5000",
    name: "Wages",
    type: "Expense",
    subtype: "Operating Expense",
    description: "",
    isActive: true,
  },
];

const balancedEntry = (overrides: Partial<JournalEntry> = {}): JournalEntry => ({
  id: "je-1",
  ref: "JE-0001",
  date: "2026-09-01",
  description: "Fee collection",
  status: "posted",
  created_by: "u1",
  fiscal_year: "2026",
  fiscal_year_id: "fy-2026",
  tags: [],
  attachments: [],
  lines: [
    { id: "l1", account_id: "a-cash", debit: 0.1, credit: 0, description: "" },
    { id: "l2", account_id: "a-cash", debit: 0.2, credit: 0, description: "" },
    { id: "l3", account_id: "a-income", debit: 0, credit: 0.3, description: "" },
  ],
  ...overrides,
});

describe("computeLedger", () => {
  it("returns cent-exact line money so a running balance never drifts", () => {
    const lines = computeLedger("a-cash", [balancedEntry()]);
    expect(lines).toHaveLength(2);
    expect(lines.map((ledgerLine) => ledgerLine.debit)).toEqual([0.1, 0.2]);
    const runningCents = lines.reduce(
      (cents, ledgerLine) => cents + moneyToCents(ledgerLine.debit),
      0,
    );
    expect(String(centsToMoney(runningCents))).toBe("0.3");
  });

  it("ignores draft entries", () => {
    expect(computeLedger("a-cash", [balancedEntry({ status: "draft" })])).toHaveLength(0);
  });
});

describe("computeTrialBalance", () => {
  it("aggregates in integer cents", () => {
    const rows = computeTrialBalance(accounts, [balancedEntry()]);
    const cash = rows.find((row) => row.id === "a-cash");
    const income = rows.find((row) => row.id === "a-income");
    expect(cash?.totalDebit).toBe(0.3);
    expect(cash?.balance).toBe(0.3);
    expect(income?.totalCredit).toBe(0.3);
    expect(income?.balance).toBe(0.3);
  });

  it("stays exactly balanced across an entry whose lines are float-hostile", () => {
    const rows = computeTrialBalance(accounts, [balancedEntry()]);
    const debitTotal = rows.reduce((sum, row) => sum + Math.round(row.totalDebit * 100), 0);
    const creditTotal = rows.reduce((sum, row) => sum + Math.round(row.totalCredit * 100), 0);
    expect(debitTotal).toBe(creditTotal);
  });
});

describe("computeFinancials", () => {
  it("reports cent-exact money figures", () => {
    const financials = computeFinancials(accounts, [balancedEntry()]);
    expect(financials.revenue).toBe(0.3);
    expect(financials.assets).toBe(0.3);
    expect(financials.cashInflow).toBe(0.3);
    expect(financials.cashOutflow).toBe(0);
  });
});

describe("hasReversalEntry", () => {
  it("detects an existing reversal of the same reference", () => {
    const original = balancedEntry();
    const reversal: JournalEntry = {
      ...original,
      id: "je-rev",
      ref: "REV-JE-0001",
      reversed_ref: "JE-0001",
    };
    expect(hasReversalEntry(original, [original])).toBe(false);
    expect(hasReversalEntry(original, [original, reversal])).toBe(true);
    expect(hasReversalEntry(reversal, [original, reversal])).toBe(false);
  });
});

function createEntry(id: string, ref: string, overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id,
    ref,
    date: "2026-03-01",
    description: "Test entry",
    status: "posted",
    created_by: "admin",
    fiscal_year: "FY 2026",
    tags: [],
    attachments: [],
    lines: [],
    ...overrides,
  };
}

describe("accountingData reference utilities", () => {
  describe("isJournalRefUnique", () => {
    it("returns true for empty or whitespace-only reference", () => {
      const entries = [createEntry("je-1", "JE-0001")];
      expect(isJournalRefUnique("", entries)).toBe(true);
      expect(isJournalRefUnique("   ", entries)).toBe(true);
    });

    it("returns false when another active entry shares the reference case-insensitively", () => {
      const entries = [createEntry("je-1", "JE-0001")];
      expect(isJournalRefUnique("JE-0001", entries)).toBe(false);
      expect(isJournalRefUnique("je-0001", entries)).toBe(false);
      expect(isJournalRefUnique("  JE-0001  ", entries)).toBe(false);
    });

    it("returns true when the only matching entry is the one being edited (currentId matches)", () => {
      const entries = [createEntry("je-1", "JE-0001")];
      expect(isJournalRefUnique("JE-0001", entries, "je-1")).toBe(true);
    });

    it("returns false when matching entry has a different id from currentId", () => {
      const entries = [createEntry("je-1", "JE-0001"), createEntry("je-2", "JE-0002")];
      expect(isJournalRefUnique("JE-0002", entries, "je-1")).toBe(false);
    });

    it("ignores soft-deleted entries when checking uniqueness", () => {
      const entries = [createEntry("je-1", "JE-0001", { deletedAt: "2026-03-01T00:00:00.000Z" })];
      expect(isJournalRefUnique("JE-0001", entries)).toBe(true);
    });
  });
});
