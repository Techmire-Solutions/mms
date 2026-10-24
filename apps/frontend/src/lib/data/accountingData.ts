import {
  ACCOUNTING_ACCOUNT_TYPES,
  ACCOUNT_SUBTYPES,
  type Account,
  type JournalLine,
  type JournalEntry,
  type FiscalYear,
  type AccountingSettings,
  DEFAULT_ACCOUNTING_SETTINGS as DEFAULT_SETTINGS,
} from "@mms/shared";
import { computeLedger, computeTrialBalance, computeFinancials } from "./accountingCalculations";

export const ACCOUNT_TYPES = ACCOUNTING_ACCOUNT_TYPES;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export { ACCOUNT_SUBTYPES };

export const ACCOUNT_TYPE_META = {
  Asset: {
    normalBalance: "debit",
    color: "bg-info/15 text-info border-info/30",
    group: "balance" as const,
    icon: "🏦",
  },
  Liability: {
    normalBalance: "credit",
    color: "bg-destructive/15 text-destructive border-destructive/30",
    group: "balance" as const,
    icon: "💳",
  },
  Equity: {
    normalBalance: "credit",
    color: "bg-primary/15 text-primary border-primary/30",
    group: "balance" as const,
    icon: "📊",
  },
  Revenue: {
    normalBalance: "credit",
    color: "bg-success/15 text-success border-success/30",
    group: "income" as const,
    icon: "💰",
  },
  Expense: {
    normalBalance: "debit",
    color: "bg-warning/15 text-warning border-warning/30",
    group: "income" as const,
    icon: "📉",
  },
};

export type { Account, JournalLine, JournalEntry, FiscalYear, AccountingSettings };
export { DEFAULT_SETTINGS, computeLedger, computeTrialBalance, computeFinancials };

/**
 * Convert integer cents back to a money number for display/export.
 */
export function centsToMoney(cents: number): number {
  return cents / 100;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

/**
 * Journal tags offered by the entry form and the tag filter.
 */
export const JOURNAL_TAGS = [
  "Payroll",
  "Fees",
  "Donation",
  "Obligation",
  "Utilities",
  "Rent",
  "Capital",
  "Expense",
  "Adjustment",
  "Reversal",
  "Opening",
];
/** True when another entry already reverses `entry` (guards double reversal). */
export function hasReversalEntry(entry: JournalEntry, allEntries: JournalEntry[]): boolean {
  return allEntries.some(
    (candidate) => candidate.id !== entry.id && candidate.reversed_ref === entry.ref,
  );
}

export function isJournalRefUnique(
  ref: string,
  entries: readonly JournalEntry[],
  currentId?: string,
): boolean {
  const clean = ref?.trim();
  if (!clean) return true;
  return !entries.some(
    (e) =>
      !e.deletedAt &&
      e.ref?.trim().toLowerCase() === clean.toLowerCase() &&
      (!currentId || e.id !== currentId),
  );
}
