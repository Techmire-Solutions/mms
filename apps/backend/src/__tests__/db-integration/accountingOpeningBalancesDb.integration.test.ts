import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant } from "../../db/tenant-context.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import {
  accountingAccounts,
  accountingEntries,
  accountingFiscalYears,
  auditTrailEvents,
  workspaces,
} from "../../db/schema.js";
import {
  postOpeningBalances,
  upsertOpeningBalances,
} from "../../accounting/use-cases/accountingLedgerOpsUseCases.js";
import { loadAccountLedger } from "../../accounting/use-cases/accountingReportEndpointsUseCases.js";
import { reverseJournalEntry } from "../../accounting/use-cases/reverseJournalEntryUseCase.js";
import { reverseJournalEntryDeps } from "../../accounting/use-cases/reverseJournalEntryDeps.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const SUFFIX = randomUUID().slice(0, 8);
const TENANT = `opening-db-${SUFFIX}`;
const FY = `fy-${SUFFIX}`;
const CASH = `cash-${SUFFIX}`;
const EQUITY = `equity-${SUFFIX}`;

async function purge(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    for (const table of [
      "audit_trail_events",
      "accounting_opening_balances",
      "accounting_journal_lines",
      "accounting_entries",
      "accounting_fiscal_years",
      "accounting_accounts",
    ]) {
      await tx.execute(sql.raw(`DELETE FROM "${table}" WHERE workspace_subdomain = '${TENANT}'`));
    }
    await tx.execute(sql`DELETE FROM workspaces WHERE subdomain = ${TENANT}`);
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();
  await withGlobalTenant(async (tx) => {
    await tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: "Opening balances",
      enabled: true,
    });
  });
  await withTenant(TENANT, async (tx) => {
    await tx.insert(accountingFiscalYears).values({
      id: FY,
      workspaceSubdomain: TENANT,
      label: "FY 2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
    });
    await tx.insert(accountingAccounts).values([
      { id: CASH, workspaceSubdomain: TENANT, code: "1000", name: "Cash", type: "Asset" },
      { id: EQUITY, workspaceSubdomain: TENANT, code: "3000", name: "Capital", type: "Equity" },
    ]);
  });
});

afterAll(async () => {
  await purge();
  await closeDatabase();
});

const BALANCES = [
  { fiscalYearId: FY, accountId: CASH, debit: 1000, credit: 0 },
  { fiscalYearId: FY, accountId: EQUITY, debit: 0, credit: 1000 },
];

describe("opening balances can be corrected after a reversal", () => {
  it("posts, reverses, allows the edit and posts a revision", async () => {
    await runWithTenant(TENANT, () => upsertOpeningBalances(FY, BALANCES));
    const first = await runWithTenant(TENANT, () => postOpeningBalances(FY));
    expect(first.posted).toBe(true);

    // Unchanged replay is not reported as a new posting.
    const replay = await runWithTenant(TENANT, () => postOpeningBalances(FY));
    expect(replay.posted).toBe(false);

    const firstEntry = (
      await withTenant(TENANT, (tx) =>
        tx
          .select({ id: accountingEntries.id, sourceId: accountingEntries.sourceId })
          .from(accountingEntries)
          .where(eq(accountingEntries.sourceType, "opening")),
      )
    )[0];
    expect(firstEntry?.sourceId).toBe(FY);

    await runWithTenant(TENANT, () =>
      reverseJournalEntry(
        TENANT,
        firstEntry!.id,
        { date: "2026-12-20", reason: "revised opening capital" },
        { id: "user-1" },
        reverseJournalEntryDeps,
      ),
    );

    // Previously this threw 422 forever: the reversed original still held the
    // (opening, fiscalYearId) source key, so the advice "reverse that entry" could
    // never be followed.
    await expect(
      runWithTenant(TENANT, () =>
        upsertOpeningBalances(FY, [
          { fiscalYearId: FY, accountId: CASH, debit: 1500, credit: 0 },
          { fiscalYearId: FY, accountId: EQUITY, debit: 0, credit: 1500 },
        ]),
      ),
    ).resolves.toBeDefined();

    const revised = await runWithTenant(TENANT, () => postOpeningBalances(FY));
    expect(revised.posted).toBe(true);

    const openings = await withTenant(TENANT, (tx) =>
      tx
        .select({ sourceId: accountingEntries.sourceId })
        .from(accountingEntries)
        .where(eq(accountingEntries.sourceType, "opening")),
    );
    expect(openings.map((row) => row.sourceId).sort()).toEqual([FY, `${FY}:r2`].sort());

    // Net opening position: original 1000 − reversed 1000 + revision 1500.
    const ledger = await runWithTenant(TENANT, () =>
      loadAccountLedger({
        accountId: CASH,
        // After the reversal date, so both correction postings are in the opening.
        dateFrom: "2027-01-01",
        dateTo: "2027-12-31",
        page: 1,
        limit: 100,
      }),
    );
    expect(ledger.openingBalance).toBe(1500);
    expect(ledger.lines).toHaveLength(0);
    expect(ledger.closingBalance).toBe(1500);
  });

  it("audits the opening posting", async () => {
    const rows = await withTenant(TENANT, (tx) =>
      tx
        .select({ newState: auditTrailEvents.newState })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.tableName, "accounting_entries"),
            eq(auditTrailEvents.actionType, "CREATE"),
          ),
        ),
    );
    expect(rows.some((row) => String(row.newState).includes("opening_balances_posted"))).toBe(true);
  });
});
