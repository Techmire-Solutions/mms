import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { accountingAccounts, accountingEntries, accountingJournalLines } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import type { CashFlowSection } from "./accountingReportCashFlow.js";

/**
 * Cash-flow section classification loaders, split from
 * `accountingRepositoryReport.ts` for the 300-line ceiling. A cash movement is
 * classified by the section of its **non-cash counterpart** account, never from
 * the cash side.
 */

/**
 * Non-cash counterpart account ids per entry, restricted to entries that carry a
 * cash leg in the window. Classifying a cash movement by its counterpart is what
 * assigns it to operating/investing/financing without guessing from the cash side.
 */
export async function loadCashMovementCounterparties(
  tx: TenantTransaction,
  subdomain: string,
  cashAccountIds: readonly string[],
  dateFrom: string | undefined,
  dateTo: string | undefined,
): Promise<Map<string, string[]>> {
  if (cashAccountIds.length === 0) return new Map();
  const dateFilter = and(
    dateFrom ? sql`${accountingEntries.date} >= ${dateFrom}` : undefined,
    dateTo ? sql`${accountingEntries.date} <= ${dateTo}` : undefined,
  );
  const rows = await tx
    .select({
      entryId: accountingJournalLines.entryId,
      accountId: accountingJournalLines.accountId,
    })
    .from(accountingJournalLines)
    .innerJoin(
      accountingEntries,
      and(
        eq(accountingJournalLines.workspaceSubdomain, accountingEntries.workspaceSubdomain),
        eq(accountingJournalLines.entryId, accountingEntries.id),
        isNull(accountingEntries.deletedAt),
        eq(accountingEntries.status, "posted"),
        sql`${accountingEntries.sourceType} IS DISTINCT FROM 'closing'`,
        dateFilter,
      ),
    )
    .where(
      and(
        eq(accountingJournalLines.workspaceSubdomain, subdomain),
        sql`${accountingJournalLines.accountId} NOT IN (${sql.join(
          [...cashAccountIds].map((id) => sql`${id}`),
          sql`, `,
        )})`,
      ),
    );
  const byEntry = new Map<string, string[]>();
  for (const row of rows) {
    const list = byEntry.get(row.entryId) ?? [];
    if (!list.includes(row.accountId)) list.push(row.accountId);
    byEntry.set(row.entryId, list);
  }
  return byEntry;
}

/** Explicit per-account cash-flow section (null → inferred), for the report accounts. */
export async function loadAccountSectionMap(
  tx: TenantTransaction,
  subdomain: string,
  accountIds: readonly string[],
): Promise<Map<string, CashFlowSection>> {
  const map = new Map<string, CashFlowSection>();
  const ids = [...new Set(accountIds)].filter(Boolean);
  if (ids.length === 0) return map;
  const rows = await tx
    .select({ id: accountingAccounts.id, cashFlowSection: accountingAccounts.cashFlowSection })
    .from(accountingAccounts)
    .where(
      and(
        eq(accountingAccounts.workspaceSubdomain, subdomain),
        inArray(accountingAccounts.id, ids),
      ),
    );
  for (const row of rows) {
    if (row.cashFlowSection) map.set(row.id, row.cashFlowSection as CashFlowSection);
  }
  return map;
}
