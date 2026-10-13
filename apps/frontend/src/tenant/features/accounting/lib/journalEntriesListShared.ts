import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { ReactNode } from "react";
import type { AppTranslationKey } from "@mms/shared";
import { moneyToCents } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { JournalEntry } from "@/lib/data/accountingData";

export const JOURNAL_LEADING_COLUMN_KEYS = ["ref", "date", "description", "tags"] as const;

export interface JournalEntriesListProps {
  viewMode: WorkDirectoryViewMode;
  entries: JournalEntry[];
  selectedIds: string[];
  canDelete: boolean;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  isColumnVisible: (key: string) => boolean;
  journalStatusConfig: Record<string, StatusBadgeConfigItem>;
  grandDebit: number;
  grandCredit: number;
  formatAmount: (amount: number) => string;
  /** Table row-actions renderer (shared overflow trigger). */
  renderEntryActions: (entry: JournalEntry) => ReactNode;
  /** Cards row-actions renderer (directory-card overflow trigger). */
  renderEntryActionsCards: (entry: JournalEntry) => ReactNode;
  onView: (entry: JournalEntry) => void;
  onToggleSelectedEntry: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  showDeleted?: boolean;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  onShowActive?: () => void;
  onCreate?: () => void;
  canWrite?: boolean;
}

/**
 * Line totals for one entry, summed in integer cents and converted once.
 *
 * These totals are exported verbatim into the journal CSV, and a plain float
 * reduce turned a legitimately balanced debit 0.10 + 0.20 / credit 0.30 entry
 * into `0.30000000000000004` versus `0.3`. Summing cents and dividing once by
 * 100 yields the exact two-decimal ledger figure.
 */
export function getJournalEntryLineTotals(entry: JournalEntry): {
  totalDebit: number;
  totalCredit: number;
} {
  let debitCents = 0;
  let creditCents = 0;
  for (const journalLine of entry.lines) {
    debitCents += moneyToCents(journalLine.debit);
    creditCents += moneyToCents(journalLine.credit);
  }
  return { totalDebit: debitCents / 100, totalCredit: creditCents / 100 };
}

export function getVisibleLeadingColumnCount(isColumnVisible: (key: string) => boolean): number {
  return JOURNAL_LEADING_COLUMN_KEYS.filter(isColumnVisible).length;
}

/**
 * Whether the totals of the **rows currently shown** agree, compared in integer
 * cents. The old `Math.abs(grandDebit - grandCredit) < 0.01` float tolerance
 * both called a sub-cent imbalance balanced and invented differences out of
 * float drift.
 *
 * This is deliberately a statement about the rendered page, not about the
 * ledger: the page mixes posted and draft rows, so an unbalanced draft makes it
 * false even though every posted entry balances. Callers therefore label it as
 * row-scoped ("rows shown") rather than ledger-wide.
 */
export function isJournalBalanced(grandDebit: number, grandCredit: number): boolean {
  return moneyToCents(grandDebit) === moneyToCents(grandCredit);
}

export function getJournalBalanceDifference(
  grandDebit: number,
  grandCredit: number,
  formatAmount: (amount: number) => string,
): string {
  return formatAmount(Math.abs(moneyToCents(grandDebit) - moneyToCents(grandCredit)) / 100);
}

const KNOWN_JOURNAL_TAG_KEYS = new Set([
  "adjustment",
  "capital",
  "donation",
  "expense",
  "fees",
  "obligation",
  "opening",
  "payroll",
  "rent",
  "reversal",
  "utilities",
]);

export function getJournalTagLabel(tag: string, t: TranslationFunction): string {
  const normalized = tag.toLowerCase();
  if (KNOWN_JOURNAL_TAG_KEYS.has(normalized)) {
    return t(`accounting.journal.tag.${normalized}` as AppTranslationKey);
  }
  return tag;
}
