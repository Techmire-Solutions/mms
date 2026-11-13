import { describe, expect, it } from "vitest";
import { isJournalEntryBalanced, moneyToCents } from "@mms/shared";
import {
  centsToMoney,
  hasReversalEntry,
  isJournalRefUnique,
  type JournalEntry,
} from "./accountingData";

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

describe("centsToMoney", () => {
  it("round-trips cent-exact money so a running balance never drifts", () => {
    // The ledger math itself is server-authoritative and covered by the shared
    // `accountingLedgerInvariants`/report tests; this helper only converts back for
    // display, so 0.1 + 0.2 must come back as exactly 0.3.
    const cents = moneyToCents(0.1) + moneyToCents(0.2);
    expect(String(centsToMoney(cents))).toBe("0.3");
  });

  it("agrees with the shared balance rule on a float-hostile entry", () => {
    const lines = [
      { debit: moneyToCents(0.1), credit: 0 },
      { debit: moneyToCents(0.2), credit: 0 },
      { debit: 0, credit: moneyToCents(0.3) },
    ].map((line) => ({ debit: centsToMoney(line.debit), credit: centsToMoney(line.credit) }));
    expect(isJournalEntryBalanced(lines)).toBe(true);
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
