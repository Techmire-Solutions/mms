import type { AppTranslationKey } from "@mms/shared";
import { moneyToCents } from "@mms/shared";
import type { Account, JournalEntry } from "@/lib/data/accountingData";
import { classifyEntry, getEntryAmount } from "./cashbookClassification";

export { classifyEntry, getEntryAmount };

const NON_CASH_ASSET_RE = /receiv|prepaid|accumulated|contra|deposit|advance/i;

export type EntryType = "in" | "out" | "transfer" | "unclassified";

export interface CashbookRow extends JournalEntry {
  flowType: EntryType;
  flowAmount: number;
  flowLabel: string;
}

/**
 * Is this account a cash/bank account by its own type, code, subtype or name?
 */
export function isCashAccount(account: Account): boolean {
  if (account.type !== "Asset") return false;
  const haystack = `${account.name} ${account.subtype ?? ""}`.toLowerCase();
  if (NON_CASH_ASSET_RE.test(haystack)) return false;
  return account.code.startsWith("10") || haystack.includes("cash") || haystack.includes("bank");
}

/**
 * Ids of the accounts that can hold cash.
 */
export function resolveCashAccountIds(
  accounts: readonly Account[],
  configuredCashAccountId?: string | null,
): Set<string> {
  const ids = new Set<string>();
  if (configuredCashAccountId) ids.add(configuredCashAccountId);
  for (const account of accounts) {
    if (isCashAccount(account)) ids.add(account.id);
  }
  return ids;
}

export function getEntryLabel(
  entry: JournalEntry & { transaction_type?: string },
  t: (key: AppTranslationKey) => string,
): string {
  if (entry.transaction_type) {
    const translationKey =
      `accounting.transaction.type.${entry.transaction_type}` as AppTranslationKey;
    const translatedValue = t(translationKey);
    return translatedValue && translatedValue !== translationKey
      ? translatedValue
      : entry.transaction_type;
  }
  const tags = entry.tags || [];
  if (tags.length > 0) return tags[0];
  return t("accounting.transaction.type.transaction");
}

export interface BuildCashbookRowsOptions {
  cashAccountIds?: ReadonlySet<string>;
}

export function buildCashbookRows(
  entries: JournalEntry[],
  search: string,
  filterType: EntryType | "all",
  t: (key: AppTranslationKey) => string,
  options: BuildCashbookRowsOptions = {},
): CashbookRow[] {
  const { cashAccountIds } = options;
  return entries
    .filter((journalEntry) => journalEntry.status === "posted")
    .map((journalEntry) => {
      const flowType = classifyEntry(journalEntry, cashAccountIds);
      return {
        ...journalEntry,
        flowType,
        flowAmount: getEntryAmount(journalEntry, flowType, cashAccountIds),
        flowLabel:
          flowType === "unclassified"
            ? t("accounting.cashbook.unclassified")
            : getEntryLabel(journalEntry, t),
      };
    })
    .filter((cashbookRow) => filterType === "all" || cashbookRow.flowType === filterType)
    .filter(
      (cashbookRow) =>
        !search ||
        cashbookRow.description.toLowerCase().includes(search.toLowerCase()) ||
        cashbookRow.ref.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((firstRow, secondRow) => secondRow.date.localeCompare(firstRow.date));
}

/** Number of rows in each flow bucket — used to surface unclassified rows. */
export function countCashbookRowsByType(rows: readonly CashbookRow[]): Record<EntryType, number> {
  const counts: Record<EntryType, number> = { in: 0, out: 0, transfer: 0, unclassified: 0 };
  for (const cashbookRow of rows) counts[cashbookRow.flowType] += 1;
  return counts;
}

export interface CashbookTotalsCents {
  totalInCents: number;
  totalOutCents: number;
  balanceCents: number;
}

/**
 * Money-in / money-out / balance over the rows shown, in integer cents.
 */
export function sumCashbookTotals(rows: readonly CashbookRow[]): CashbookTotalsCents {
  let totalInCents = 0;
  let totalOutCents = 0;
  for (const cashbookRow of rows) {
    if (cashbookRow.flowType === "in") totalInCents += moneyToCents(cashbookRow.flowAmount);
    else if (cashbookRow.flowType === "out") totalOutCents += moneyToCents(cashbookRow.flowAmount);
  }
  return { totalInCents, totalOutCents, balanceCents: totalInCents - totalOutCents };
}

export type CashbookFooterCell =
  { kind: "label" | "blank"; span: number } | { kind: "moneyIn" | "moneyOut"; span: 1 };

/**
 * Footer cells for the visible column order: consecutive non-money columns merge into one
 * spanning cell (the first carries the count label) and totals sit under their money columns.
 */
export function buildCashbookFooterCells(
  visibleColumnIds: readonly string[],
): CashbookFooterCell[] {
  const cells: CashbookFooterCell[] = [];
  let span = 0;
  let labelled = false;
  const flush = () => {
    if (span === 0) return;
    cells.push({ kind: labelled ? "blank" : "label", span });
    labelled = true;
    span = 0;
  };
  for (const id of visibleColumnIds) {
    if (id === "moneyIn" || id === "moneyOut") {
      flush();
      cells.push({ kind: id, span: 1 });
    } else {
      span += 1;
    }
  }
  flush();
  return cells;
}
