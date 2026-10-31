import { sql } from "drizzle-orm";
import { withTenant } from "../../db/tenant-context.js";

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
