import {
  dedupeTrimmedIds,
  findFiscalYearForDate,
  isFiscalYearClosed,
  isJournalEntryBalanced,
  isValidIsoDate,
  resolveFiscalYearRef,
  type Account,
  type FiscalYear,
  type JournalEntry,
} from "@mms/shared";

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

/**
 * Resolve the fiscal-year FK from id or legacy label and reject unbalanced
 * posted writes. Drafts may be unbalanced.
 *
 * When neither `fiscal_year_id` nor `fiscal_year` is supplied, the year
 * containing the entry date is used instead of leaving the FK NULL — a NULL FK
 * makes the row invisible to every fiscal-year-scoped view.
 *
 * Period locks and account checks are deliberately NOT applied here: bulk
 * collection saves re-send unchanged rows, and those must not be re-validated
 * against state that has legitimately moved on (a year closed since, an account
 * archived since). Callers apply {@link assertJournalEntryPeriodOpen} to
 * new-or-changed rows only.
 */
export function prepareJournalEntryForPersist(
  entry: JournalEntry,
  fiscalYears: readonly FiscalYear[],
): JournalEntry {
  // Reports filter by this string and compare it lexicographically, so shape and
  // calendar validity both matter — '2025-6-5' would sort into the wrong period.
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

/**
 * Closed-period lock.
 *
 * Two independent checks, because either one alone is bypassable:
 *
 * 1. the **declared** fiscal year must not be closed (the original guard), and
 * 2. the fiscal year **containing the entry date** must not be closed.
 *
 * Check 2 is the one that matters in practice: reports filter by `date`, so an
 * entry dated inside a closed period contaminates that period's figures no
 * matter which year it claims to belong to. Without it, omitting the fiscal-year
 * fields — or labelling the entry with the currently-active year, which is what
 * the journal form does — posts straight into a closed period.
 *
 * A date outside every configured year is allowed: a workspace with no fiscal
 * years configured must stay postable.
 */
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

/**
 * Active foreign-key guard: a journal line may not reference an unknown,
 * archived or deactivated account. The FK only enforces existence and archiving
 * is a soft delete, so both flags have to be honoured here.
 */
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

export { ledgerError };
