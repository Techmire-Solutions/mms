import {
  dedupeTrimmedIds,
  findFiscalYearForDate,
  isFiscalYearClosed,
  isJournalEntryBalanced,
  isValidIsoDate,
  moneyToCents,
  resolveFiscalYearRef,
  type Account,
  type FiscalYear,
  type JournalEntry,
} from "@mms/shared";
import { ConflictError } from "../../lib/httpErrors.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import type { AccountingRepository } from "../repository/accountingRepository.js";

export type AccountingLedgerHttpError = Error & {
  statusCode: number;
  type: "validation_error";
};

function ledgerError(message: string): AccountingLedgerHttpError {
  const error = new Error(message) as AccountingLedgerHttpError;
  error.statusCode = 422;
  error.type = "validation_error";
  return error;
}

export function prepareJournalEntryForPersist(
  entry: JournalEntry,
  fiscalYears: readonly FiscalYear[],
): JournalEntry {
  if (!isValidIsoDate(entry.date ?? "")) {
    throw ledgerError("Journal entry date must be a real calendar date in YYYY-MM-DD format");
  }

  const declared = resolveFiscalYearRef(fiscalYears, entry.fiscal_year_id ?? entry.fiscal_year);
  const containing = findFiscalYearForDate(fiscalYears, entry.date);
  const resolved = declared ?? containing;

  if (entry.status === "posted" && !isJournalEntryBalanced(entry.lines ?? [])) {
    throw ledgerError("Posted journal entries must have matching debit and credit totals");
  }

  return {
    ...entry,
    fiscal_year_id: resolved?.id ?? entry.fiscal_year_id,
    fiscal_year: resolved?.label ?? entry.fiscal_year,
    source_type: entry.source_type ?? "manual",
  };
}

export function assertJournalEntryPeriodOpen(
  entry: JournalEntry,
  fiscalYears: readonly FiscalYear[],
): void {
  const declared = resolveFiscalYearRef(fiscalYears, entry.fiscal_year_id ?? entry.fiscal_year);
  if (isFiscalYearClosed(declared)) {
    throw ledgerError("Cannot mutate journal entries in a closed fiscal year");
  }

  const containing = findFiscalYearForDate(fiscalYears, entry.date);
  if (isFiscalYearClosed(containing)) {
    throw ledgerError(
      `Cannot write journal entries dated inside a closed fiscal year${containing?.label ? ` (${containing.label})` : ""}`,
    );
  }
}

export async function assertJournalAccountsWritable(
  tenant: string,
  entries: readonly JournalEntry[],
  findAccountsByIds: (tenant: string, ids: string[]) => Promise<Account[]>,
): Promise<void> {
  const accountIds = dedupeTrimmedIds(
    entries.flatMap((entry) => (entry.lines ?? []).map((line) => line.account_id)),
  );
  if (accountIds.length === 0) return;
  const byId = new Map(
    (await findAccountsByIds(tenant, accountIds)).map((account) => [account.id, account]),
  );
  const blocked = accountIds.filter((id) => {
    const account = byId.get(id);
    return !account || account.isActive === false;
  });
  if (blocked.length > 0) {
    throw ledgerError(
      `Journal lines reference unknown, archived or deactivated accounts: ${blocked.join(", ")}`,
    );
  }
}

const carriesFx = (lines: JournalEntry["lines"]): boolean =>
  (lines ?? []).every((line) => !!line.txn_currency);

function normalizeLines(lines: JournalEntry["lines"], withFx: boolean): string {
  return (lines ?? [])
    .map((line) =>
      [
        line.account_id,
        moneyToCents(line.debit),
        moneyToCents(line.credit),
        line.description ?? "",
        ...(withFx ? [line.txn_currency, line.txn_debit, line.txn_credit, line.exchange_rate] : []),
      ].join("|"),
    )
    .sort()
    .join(";");
}

/**
 * IAS 21 amounts take part in the comparison only when both sides carry them, so
 * a stored row written before the backfill never reads as "changed".
 */
function linesDiffer(incoming: JournalEntry["lines"], stored: JournalEntry["lines"]): boolean {
  const withFx = carriesFx(incoming) && carriesFx(stored);
  return normalizeLines(incoming, withFx) !== normalizeLines(stored, withFx);
}

function normalizeList(values: readonly string[] | undefined): string {
  return [...(values ?? [])].sort().join("|");
}

export function journalEntryContentChanged(incoming: JournalEntry, stored: JournalEntry): boolean {
  return (
    incoming.date !== stored.date ||
    (incoming.ref ?? "") !== (stored.ref ?? "") ||
    (incoming.description ?? "") !== (stored.description ?? "") ||
    incoming.status !== stored.status ||
    (incoming.fiscal_year ?? "") !== (stored.fiscal_year ?? "") ||
    (incoming.fiscal_year_id ?? "") !== (stored.fiscal_year_id ?? "") ||
    (incoming.source_type ?? "") !== (stored.source_type ?? "") ||
    (incoming.source_id ?? "") !== (stored.source_id ?? "") ||
    (incoming.transaction_type ?? "") !== (stored.transaction_type ?? "") ||
    (incoming.reversed_ref ?? "") !== (stored.reversed_ref ?? "") ||
    Boolean(incoming.simple_mode) !== Boolean(stored.simple_mode) ||
    linesDiffer(incoming.lines, stored.lines) ||
    normalizeList(incoming.tags) !== normalizeList(stored.tags) ||
    normalizeList(incoming.attachments) !== normalizeList(stored.attachments)
  );
}

export function mapJournalEntryUniqueError(error: unknown): never {
  const pgErr = error as { constraint?: string; message?: string };
  if (
    pgErr.constraint === "accounting_entries_workspace_ref_active_uidx" ||
    pgErr.message?.includes("accounting_entries_workspace_ref_active_uidx")
  ) {
    throw new ConflictError("A journal entry with this reference already exists");
  }
  throw new ConflictError(
    "A journal entry already exists for this source (conflicting source_type/source_id)",
  );
}

export async function loadStoredEntriesByIds(
  repo: Pick<AccountingRepository, "findEntriesByIds">,
  entries: readonly JournalEntry[],
): Promise<Map<string, JournalEntry>> {
  const tenant = getRequestTenant();
  if (!tenant) return new Map();
  const ids = dedupeTrimmedIds(entries.map((entry) => entry.id));
  if (ids.length === 0) return new Map();
  const stored = await repo.findEntriesByIds(tenant, ids);
  return new Map(stored.map((entry) => [entry.id, entry]));
}

export function withServerOwnedSourceKeys(
  entry: JournalEntry,
  stored: JournalEntry | undefined,
): JournalEntry {
  return {
    ...entry,
    source_type: stored ? stored.source_type : "manual",
    source_id: stored ? stored.source_id : undefined,
    reversed_ref: stored ? stored.reversed_ref : undefined,
  };
}

export function assertEntriesMutable(
  entries: readonly JournalEntry[],
  storedById: ReadonlyMap<string, JournalEntry>,
): void {
  for (const incoming of entries) {
    const existing = storedById.get(incoming.id);
    if (!existing || existing.status !== "posted") continue;
    if (journalEntryContentChanged(incoming, existing)) {
      throw Object.assign(
        new Error("Posted journal entries are immutable — reverse them instead of editing"),
        { statusCode: 422, type: "validation_error" },
      );
    }
  }
}

export async function assertEntriesWritable(
  tenant: string,
  entries: readonly JournalEntry[],
  storedById: ReadonlyMap<string, JournalEntry>,
  fiscalYears: readonly FiscalYear[],
  findAccountsByIds: (tenant: string, ids: string[]) => Promise<Account[]>,
): Promise<void> {
  const targets = entries.filter((entry) => {
    const existing = storedById.get(entry.id);
    return !existing || journalEntryContentChanged(entry, existing);
  });
  if (targets.length === 0) return;
  for (const entry of targets) assertJournalEntryPeriodOpen(entry, fiscalYears);
  await assertJournalAccountsWritable(tenant, targets, findAccountsByIds);
}

export { ledgerError };
