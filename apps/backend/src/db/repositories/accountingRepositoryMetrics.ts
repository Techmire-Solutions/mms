import { and, eq, isNull, sql } from "drizzle-orm";
import {
  MODULE_METRICS_DEFAULT_PERIOD_DAYS,
  type AccountingCommandMetricsSnapshot,
} from "@mms/shared";
import { accountingAccounts, accountingEntries, accountingJournalLines } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

/**
 * SQL aggregates for Accounting command-centre metrics. Sign conventions
 * mirror the prior JS reducer (`computeAccountingCommandMetrics`):
 *   assets     = sum(debit - credit)  for type = 'Asset'
 *   liabilities= sum(credit - debit)   for type = 'Liability'
 *   revenue    = sum(credit - debit)   for type = 'Revenue'
 *   expenses   = sum(debit - credit)   for type = 'Expense'
 *   surplus    = revenue - expenses
 * `postedVolume` sums `debit` over every line of posted active entries
 * (regardless of whether the line's account exists), so it is computed via a
 * LEFT JOIN to accounts while balances use CASE on account type (missing or
 * soft-deleted accounts contribute 0, matching the JS `accountById.get` skip).
 */
export async function aggregateAccountingCommandMetrics(
  tenant: string,
  periodDays: number = MODULE_METRICS_DEFAULT_PERIOD_DAYS,
): Promise<AccountingCommandMetricsSnapshot> {
  const subdomain = tenant.trim().toLowerCase();
  const safePeriodDays =
    Number.isFinite(periodDays) && periodDays > 0 ? periodDays : MODULE_METRICS_DEFAULT_PERIOD_DAYS;
  const periodStart = new Date(Date.now() - safePeriodDays * 86_400_000).toISOString().slice(0, 10);

  return withTenantRead(subdomain, async (tx) => {
    const activeEntries = and(
      eq(accountingEntries.workspaceSubdomain, subdomain),
      isNull(accountingEntries.deletedAt),
    );

    const [entryRow] = await tx
      .select({
        totalEntries: sql<number>`count(*)::int`,
        posted: sql<number>`count(*) filter (where ${accountingEntries.status} = 'posted')::int`,
        draft: sql<number>`count(*) filter (where ${accountingEntries.status} = 'draft')::int`,
        newThisPeriod: sql<number>`count(*) filter (where ${accountingEntries.date} >= ${periodStart})::int`,
      })
      .from(accountingEntries)
      .where(activeEntries);

    const activeAccounts = and(
      eq(accountingAccounts.workspaceSubdomain, subdomain),
      isNull(accountingAccounts.deletedAt),
    );
    const [accountRow] = await tx
      .select({
        activeAccounts: sql<number>`count(*) filter (where ${accountingAccounts.isActive} = true)::int`,
        inactiveAccounts: sql<number>`count(*) filter (where ${accountingAccounts.isActive} = false)::int`,
      })
      .from(accountingAccounts)
      .where(activeAccounts);

    // Lines of posted active entries, LEFT JOINed to active accounts. Missing /
    // soft-deleted accounts contribute 0 to balances (acc.type is null) but
    // their lines still count toward postedVolume.
    const [balanceRow] = await tx
      .select({
        postedVolume: sql<number>`coalesce(sum(${accountingJournalLines.debit}), 0)::float8`,
        assets: sql<number>`coalesce(sum(case when ${accountingAccounts.type} = 'Asset' then ${accountingJournalLines.debit} - ${accountingJournalLines.credit} else 0 end), 0)::float8`,
        liabilities: sql<number>`coalesce(sum(case when ${accountingAccounts.type} = 'Liability' then ${accountingJournalLines.credit} - ${accountingJournalLines.debit} else 0 end), 0)::float8`,
        revenue: sql<number>`coalesce(sum(case when ${accountingAccounts.type} = 'Revenue' then ${accountingJournalLines.credit} - ${accountingJournalLines.debit} else 0 end), 0)::float8`,
        expenses: sql<number>`coalesce(sum(case when ${accountingAccounts.type} = 'Expense' then ${accountingJournalLines.debit} - ${accountingJournalLines.credit} else 0 end), 0)::float8`,
      })
      .from(accountingJournalLines)
      .innerJoin(
        accountingEntries,
        and(
          eq(accountingJournalLines.workspaceSubdomain, accountingEntries.workspaceSubdomain),
          eq(accountingJournalLines.entryId, accountingEntries.id),
          isNull(accountingEntries.deletedAt),
          eq(accountingEntries.status, "posted"),
        ),
      )
      .leftJoin(
        accountingAccounts,
        and(
          eq(accountingJournalLines.workspaceSubdomain, accountingAccounts.workspaceSubdomain),
          eq(accountingJournalLines.accountId, accountingAccounts.id),
          isNull(accountingAccounts.deletedAt),
        ),
      )
      .where(eq(accountingJournalLines.workspaceSubdomain, subdomain));

    const revenue = Number(balanceRow?.revenue ?? 0);
    const expenses = Number(balanceRow?.expenses ?? 0);

    return {
      totalEntries: Number(entryRow?.totalEntries ?? 0),
      posted: Number(entryRow?.posted ?? 0),
      draft: Number(entryRow?.draft ?? 0),
      activeAccounts: Number(accountRow?.activeAccounts ?? 0),
      inactiveAccounts: Number(accountRow?.inactiveAccounts ?? 0),
      newThisPeriod: Number(entryRow?.newThisPeriod ?? 0),
      postedVolume: Number(balanceRow?.postedVolume ?? 0),
      revenue,
      expenses,
      surplus: revenue - expenses,
      assets: Number(balanceRow?.assets ?? 0),
      liabilities: Number(balanceRow?.liabilities ?? 0),
    };
  });
}
