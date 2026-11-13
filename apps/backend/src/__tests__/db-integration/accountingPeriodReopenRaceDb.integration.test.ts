import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant } from "../../db/tenant-context.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import {
  accountingAccounts,
  accountingFiscalYears,
  accountingPostingPeriods,
  workspaces,
} from "../../db/schema.js";
import { reopenPostingPeriod } from "../../accounting/use-cases/accountingPostingPeriodUseCases.js";
import { closeFiscalYearForTenant } from "../../accounting/use-cases/accountingPeriodClose.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Reopen-versus-close race (0254).
 *
 * `reopenPostingPeriod` used to read the fiscal year and only then take the advisory
 * lock that the close holds. A close committing while the reopen waited left an *open*
 * period inside a *closed* fiscal year — the state the monthly lock exists to prevent.
 * The lock is now taken before the validating reads, and the database refuses the
 * reopen on its own (`trg_accounting_posting_periods_status_guard`).
 */
const SUFFIX = randomUUID().slice(0, 8);
const TENANT = `period-race-${SUFFIX}`;
const YEAR = `fy-race-${SUFFIX}`;
const CASH = `cash-${SUFFIX}`;
const REVENUE = `revenue-${SUFFIX}`;
const RETAINED = `retained-${SUFFIX}`;

async function cleanup(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    for (const table of [
      "accounting_journal_lines",
      "accounting_entries",
      "accounting_posting_periods",
      "accounting_fiscal_years",
      "accounting_accounts",
    ]) {
      await tx.execute(sql.raw(`DELETE FROM "${table}" WHERE workspace_subdomain = '${TENANT}'`));
    }
    await tx.execute(sql`DELETE FROM workspaces WHERE subdomain = ${TENANT}`);
  });
}

/** One period of the racing year, currently closed by an accountant. */
async function closedPeriodId(): Promise<string> {
  const [period] = await withTenant(TENANT, async (tx) => {
    const rows = await tx
      .select({ id: accountingPostingPeriods.id })
      .from(accountingPostingPeriods)
      .where(eq(accountingPostingPeriods.fiscalYearId, YEAR));
    const target = rows[0]!.id;
    await tx
      .update(accountingPostingPeriods)
      .set({ status: "closed" })
      .where(eq(accountingPostingPeriods.id, target));
    return [{ id: target }];
  });
  return period!.id;
}

async function openPeriodCount(): Promise<number> {
  return withTenant(TENANT, async (tx) => {
    const rows = await tx
      .select({ id: accountingPostingPeriods.id })
      .from(accountingPostingPeriods)
      .where(
        sql`accounting_posting_periods.fiscal_year_id = ${YEAR} AND accounting_posting_periods.status = 'open'`,
      );
    return rows.length;
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await cleanup();
  await withGlobalTenant(async (tx) => {
    await tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: TENANT,
      enabled: true,
    });
  });
  await withTenant(TENANT, async (tx) => {
    await tx.insert(accountingAccounts).values([
      { id: CASH, workspaceSubdomain: TENANT, code: "1000", name: "Cash", type: "Asset" },
      { id: REVENUE, workspaceSubdomain: TENANT, code: "4100", name: "Fees", type: "Revenue" },
      { id: RETAINED, workspaceSubdomain: TENANT, code: "3100", name: "Retained", type: "Equity" },
    ]);
    await tx.insert(accountingFiscalYears).values({
      id: YEAR,
      workspaceSubdomain: TENANT,
      label: "FY 2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
    });
    // `syncPostingPeriods` only runs through `saveFiscalYear`; generate the months here.
    await tx.execute(sql`
      INSERT INTO accounting_posting_periods (id, workspace_subdomain, fiscal_year_id, label, start_date, end_date, status)
      SELECT ${YEAR} || '-' || to_char(month, 'YYYY-MM'), ${TENANT}, ${YEAR},
             to_char(month, 'YYYY-MM'), month::date, (month + interval '1 month - 1 day')::date, 'open'
        FROM generate_series('2026-01-01'::date, '2026-12-01'::date, interval '1 month') AS month
      ON CONFLICT DO NOTHING
    `);
  });
});

afterAll(async () => {
  try {
    await cleanup();
  } finally {
    await closeDatabase();
  }
});

describe("posting-period reopen vs fiscal-year close (Postgres)", () => {
  it("refuses the reopen once the close has committed while it waited", async () => {
    const periodId = await closedPeriodId();

    // Connection A plays the close: it holds the same advisory lock and then commits a
    // closed year while the reopen is blocked behind it.
    const closer = await beginLongLivedTenantTransaction(TENANT);
    await closer.tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`fy:${TENANT}:${YEAR}`}, 0))`,
    );
    await closer.tx
      .update(accountingFiscalYears)
      .set({ status: "closed" })
      .where(eq(accountingFiscalYears.id, YEAR));

    // Connection B: the reopen. It must block on the lock, not on the status read.
    const reopening = runWithTenant(TENANT, () => reopenPostingPeriod(periodId, "u-reopener"));
    // Give it time to reach the lock, then let the close commit.
    await new Promise((resolve) => setTimeout(resolve, 200));
    await closer.commit();

    await expect(reopening).rejects.toMatchObject({ statusCode: 422 });
    // The period the reopen targeted must still be closed: the write never ran.
    const [target] = await withTenant(TENANT, (tx) =>
      tx
        .select({ status: accountingPostingPeriods.status })
        .from(accountingPostingPeriods)
        .where(eq(accountingPostingPeriods.id, periodId)),
    );
    expect(target?.status).toBe("closed");
  });

  it("never ends with an open period in a closed year when both run concurrently", async () => {
    // Reset to a state where the race is meaningful: year open, one period closed.
    await withTenant(TENANT, async (tx) => {
      await tx
        .update(accountingFiscalYears)
        .set({ status: "active" })
        .where(eq(accountingFiscalYears.id, YEAR));
    });
    const periodId = await closedPeriodId();

    const [reopenResult, closeResult] = await Promise.allSettled([
      runWithTenant(TENANT, () => reopenPostingPeriod(periodId, "u-reopener")),
      runWithTenant(TENANT, () => closeFiscalYearForTenant(TENANT, YEAR, "u-closer", RETAINED)),
    ]);

    expect(closeResult.status).toBe("fulfilled");
    // Whatever interleaving happened, a closed year cannot be left with a re-opened
    // month: either the reopen won (the close then closed it again) or it was refused.
    expect(await openPeriodCount()).toBe(0);
    if (reopenResult.status === "rejected") {
      expect(String(reopenResult.reason)).toMatch(/closed fiscal year|Cannot reopen/i);
    }
  });
});
