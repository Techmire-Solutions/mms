import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds } from "@mms/shared";
import { accountingEntries, accountingJournalLines } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";

/**
 * Ledger-line lookups used by the account guards and lifecycle paths.
 *
 * Split out of `accountingAccountGuards.ts` to keep that module inside the 300-line
 * ceiling. "Active, posted" is the only definition of a ledger line that blocks an
 * archive: drafts and trashed entries are not in the ledger.
 */

/** Active, posted journal lines per account — the predicate an archive must respect. */
export function postedActiveLineScope(subdomain: string, accountIds: readonly string[]) {
  return and(
    eq(accountingJournalLines.workspaceSubdomain, subdomain),
    inArray(accountingJournalLines.accountId, [...accountIds]),
    isNull(accountingEntries.deletedAt),
    eq(accountingEntries.status, "posted"),
  );
}

/**
 * Accounts carrying active, posted ledger lines. Runs on the primary inside the
 * caller's transaction: this used to read the replica, so lag could hide a line
 * another request had just posted and allow the archive.
 */
export async function postedLineCountsByAccount(
  tx: TenantTransaction,
  subdomain: string,
  accountIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const ids = dedupeTrimmedIds([...accountIds]);
  if (ids.length === 0) return counts;
  const rows = await tx
    .select({ accountId: accountingJournalLines.accountId, count: sql<number>`count(*)::int` })
    .from(accountingJournalLines)
    .innerJoin(
      accountingEntries,
      and(
        eq(accountingJournalLines.workspaceSubdomain, accountingEntries.workspaceSubdomain),
        eq(accountingJournalLines.entryId, accountingEntries.id),
      ),
    )
    .where(postedActiveLineScope(subdomain, ids))
    .groupBy(accountingJournalLines.accountId);
  for (const row of rows) counts.set(row.accountId, row.count);
  return counts;
}
