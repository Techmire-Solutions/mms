import { sql } from "drizzle-orm";
import {
  findFiscalYearForDate,
  resolveFiscalYearRef,
  type FiscalYear,
  type JournalEntry,
} from "@mms/shared";
import { withTenant } from "../../db/tenant-context.js";
import { listFiscalYearsByWorkspace } from "../../db/repositories/accountingFiscalYearsRepository.js";

/**
 * Serialises postings and the fiscal-year close for one accounting year.
 *
 * The close holds this transaction-scoped advisory lock before it aggregates the
 * trial balance, and every posting path takes the same lock before it checks the
 * period. Without it, an entry could commit between the close's aggregate read
 * and its `status = 'closed'` write and be omitted from the closing entry.
 *
 * The key is `fy:<tenant>:<yearId>` (hashed server-side). Locks are acquired in
 * sorted order so a batch spanning several years cannot deadlock with another
 * batch. Re-acquiring the lock in the same transaction is a no-op.
 *
 * Callers must re-read the fiscal years *after* this returns: a close that won
 * the lock may have committed while the caller waited, so a status check made
 * before the lock is stale.
 */
export async function lockFiscalYearForPosting(
  tenant: string,
  fiscalYearIds: readonly (string | null | undefined)[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  if (!subdomain) return;
  const ids = [
    ...new Set(
      fiscalYearIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id): id is string => id.length > 0),
    ),
  ].sort();
  if (ids.length === 0) return;
  await withTenant(subdomain, async (tx) => {
    if (typeof tx.execute !== "function") return;
    for (const yearId of ids) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`fy:${subdomain}:${yearId}`}))`);
    }
  });
}

/**
 * Every fiscal year an entry touches: the year its **date** falls in and the year
 * it **declares** (`fiscal_year_id`/label), plus the declared id even when the
 * list does not contain it yet.
 *
 * Locking only the date's year is not enough: `prepareJournalEntryForPersist`
 * stores `declared ?? containing`, so an entry can be attributed to year A while
 * dated in year B. A close of A would then run unprotected while the posting is
 * in flight (it takes the lock for A, which nobody held) and the entry could
 * commit into a closed year.
 */
export function postingYearIds(
  entries: readonly JournalEntry[],
  years: readonly FiscalYear[],
): string[] {
  const ids = new Set<string>();
  for (const entry of entries) {
    const containing = findFiscalYearForDate(years, entry.date)?.id;
    if (containing) ids.add(containing);
    const declared =
      resolveFiscalYearRef(years, entry.fiscal_year_id ?? entry.fiscal_year)?.id ??
      entry.fiscal_year_id;
    if (declared) ids.add(declared);
  }
  return [...ids];
}

/**
 * Locks every year the batch can land in. Callers must re-read the fiscal years
 * *after* this returns (through their own loader), so a close that committed
 * while they waited is visible.
 */
export async function lockFiscalYearsForEntries(
  tenant: string,
  entries: readonly JournalEntry[],
  years?: readonly FiscalYear[],
): Promise<void> {
  const known = years ?? (await listFiscalYearsByWorkspace(tenant));
  await lockFiscalYearForPosting(tenant, postingYearIds(entries, known));
}
