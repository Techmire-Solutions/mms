import { moneyToCents } from "@mms/shared";
import type { JournalEntry } from "@/lib/data/accountingData";
import { resolveEntryDirection } from "@/tenant/features/accounting/lib/journalEntriesQuickActions";
import type { EntryType } from "./cashbookViewShared";

export interface CashMovementCents {
  debitCents: number;
  creditCents: number;
  /** False when no line of the entry touches an identified cash account. */
  hasCashLine: boolean;
}

/** Cash-side debits/credits of one entry, in integer cents. */
export function getCashMovementCents(
  entry: JournalEntry,
  cashAccountIds: ReadonlySet<string>,
): CashMovementCents {
  let debitCents = 0;
  let creditCents = 0;
  let hasCashLine = false;
  for (const journalLine of entry.lines) {
    if (!cashAccountIds.has(journalLine.account_id)) continue;
    hasCashLine = true;
    debitCents += moneyToCents(journalLine.debit);
    creditCents += moneyToCents(journalLine.credit);
  }
  return { debitCents, creditCents, hasCashLine };
}

/**
 * Cash direction of an entry.
 */
export function classifyEntry(
  entry: JournalEntry & { transaction_type?: string },
  cashAccountIds?: ReadonlySet<string>,
): EntryType {
  if (cashAccountIds && cashAccountIds.size > 0) {
    const { debitCents, creditCents, hasCashLine } = getCashMovementCents(entry, cashAccountIds);
    if (hasCashLine) {
      if (debitCents > creditCents) return "in";
      if (creditCents > debitCents) return "out";
      return "transfer";
    }
    return "unclassified";
  }
  return resolveEntryDirection(entry) ?? "transfer";
}

/**
 * Cash amount carried by one row, in money (cents-exact).
 */
export function getEntryAmount(
  entry: JournalEntry,
  type: EntryType,
  cashAccountIds?: ReadonlySet<string>,
): number {
  if (cashAccountIds && cashAccountIds.size > 0) {
    const { debitCents, creditCents, hasCashLine } = getCashMovementCents(entry, cashAccountIds);
    if (hasCashLine) {
      if (type === "in") return Math.max(debitCents - creditCents, 0) / 100;
      if (type === "out") return Math.max(creditCents - debitCents, 0) / 100;
      return Math.max(debitCents, creditCents) / 100;
    }
  }
  if (type === "in") {
    return (
      moneyToCents(entry.lines.reduce((sum, journalLine) => sum + journalLine.credit, 0)) / 100
    );
  }
  if (type === "out") {
    return moneyToCents(entry.lines.reduce((sum, journalLine) => sum + journalLine.debit, 0)) / 100;
  }
  return (
    moneyToCents(
      entry.lines.reduce(
        (largestDebit, journalLine) => Math.max(largestDebit, journalLine.debit),
        0,
      ),
    ) / 100
  );
}
