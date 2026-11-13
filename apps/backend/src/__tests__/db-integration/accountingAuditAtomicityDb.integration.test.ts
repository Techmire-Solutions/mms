import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import type { JournalEntry, OpeningBalanceInsert } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { auditTrailEvents } from "../../db/schema/auditTrail.js";
import {
  accountingAccounts,
  accountingEntries,
  accountingExchangeRates,
  accountingOpeningBalances,
  accountingPostingPeriods,
  workspaces,
} from "../../db/schema.js";
import { bulkSaveAccounts } from "../../db/repositories/accountingAccountsPersist.js";
import { saveFiscalYear } from "../../db/repositories/accountingFiscalYearsRepository.js";
import { listPostingPeriods } from "../../db/repositories/accountingPostingPeriodsRepository.js";
import { replaceOpeningBalances } from "../../db/repositories/accountingLedgerOpsRepository.js";
import { persistGeneratedEntry } from "../../accounting/ledgerPosting/ledgerPostingHelpers.js";
import { closePostingPeriod } from "../../accounting/use-cases/accountingPostingPeriodUseCases.js";
import { upsertExchangeRates } from "../../accounting/use-cases/exchangeRateUseCases.js";
import { exchangeRateDeps } from "../../accounting/use-cases/exchangeRateDeps.js";
import {
  reverseJournalEntry,
  type JournalReversalActor,
} from "../../accounting/use-cases/reverseJournalEntryUseCase.js";
import { reverseJournalEntryDeps } from "../../accounting/use-cases/reverseJournalEntryDeps.js";
import { bindRequestUserId, runWithTenant } from "../../lib/tenantContext.js";
import { requireDatabaseConnection, uniqueTenant } from "./dbTestSupport.js";
import {
  expectRejectedWith,
  installAuditFailure,
  removeAuditFailure,
} from "./auditFailureProbe.js";
import { upsertPostingRules } from "../../accounting/use-cases/accountingLedgerOpsUseCases.js";
import { accountingPostingRules } from "../../db/schema/accountingLedgerOps.js";

/**
 * Audit atomicity + coverage for the accounting ledger controls.
 *
 * The audit appender joins the caller's transaction, so a failed append must roll
 * the mutation back — and a successful mutation must leave exactly one attributed
 * row. Both directions are proven by forcing the audit insert to fail through a
 * probe trigger on `audit_trail_events` for this workspace only.
 *
 * `auditAtomicityDb` proves the contacts path; this suite is the accounting
 * counterpart and covers every mutation family that was previously unlogged
 * (generated postings, chart of accounts, opening balances).
 */

// Unique per run: the tenant literal is inlined into the probe trigger DDL, and
// a fixed id would accumulate audit rows from earlier runs.
const TENANT = uniqueTenant("audit-atomicity");
const ACTOR_ID = "u-auditor";

function entry(id: string, date = "2026-06-01"): JournalEntry {
  return {
    id,
    date,
    ref: `REF-${id}`,
    description: "",
    status: "posted",
    created_by: ACTOR_ID,
    fiscal_year: "",
    tags: [],
    attachments: [],
    lines: [
      { id: `${id}-d`, account_id: "acc-cash", debit: 10, credit: 0, description: "" },
      { id: `${id}-c`, account_id: "acc-income", debit: 0, credit: 10, description: "" },
    ],
    source_type: "manual",
    source_id: id,
  } as JournalEntry;
}

async function purge(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
    await tx.execute(sql`DROP TRIGGER IF EXISTS probe_fail_audit ON audit_trail_events`);
    await tx.execute(sql`DROP FUNCTION IF EXISTS probe_fail_audit_append()`);
  });
}

async function entryExists(id: string): Promise<boolean> {
  const rows = await withTenant(TENANT, (tx) =>
    tx
      .select({ id: accountingEntries.id })
      .from(accountingEntries)
      .where(eq(accountingEntries.id, id)),
  );
  return rows.length > 0;
}

async function auditRows(tableName: string, recordId?: string) {
  return withTenant(TENANT, (tx) =>
    tx
      .select({
        tableName: auditTrailEvents.tableName,
        recordId: auditTrailEvents.recordId,
        actionType: auditTrailEvents.actionType,
        realUserId: auditTrailEvents.realUserId,
        oldState: auditTrailEvents.oldState,
        newState: auditTrailEvents.newState,
        hashPrevious: auditTrailEvents.hashPrevious,
        hashCurrent: auditTrailEvents.hashCurrent,
      })
      .from(auditTrailEvents)
      .where(
        and(
          eq(auditTrailEvents.workspaceSubdomain, TENANT),
          eq(auditTrailEvents.tableName, tableName),
          ...(recordId ? [eq(auditTrailEvents.recordId, recordId)] : []),
        ),
      ),
  );
}

const openingRows: OpeningBalanceInsert[] = [
  { id: "ob-1", fiscalYearId: "fy-audit", accountId: "acc-cash", debit: 100, credit: 0 },
  { id: "ob-2", fiscalYearId: "fy-audit", accountId: "acc-equity", debit: 0, credit: 100 },
];

beforeEach(() => {
  bindRequestUserId(ACTOR_ID);
});

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Audit atomicity", enabled: true });
    await tx.insert(accountingAccounts).values([
      { id: "acc-cash", workspaceSubdomain: TENANT, code: "1000", name: "Cash", type: "Asset" },
      {
        id: "acc-income",
        workspaceSubdomain: TENANT,
        code: "4000",
        name: "Income",
        type: "Revenue",
      },
      {
        id: "acc-equity",
        workspaceSubdomain: TENANT,
        code: "3000",
        name: "Equity",
        type: "Equity",
      },
    ]);
  });
  await saveFiscalYear(TENANT, {
    id: "fy-audit",
    label: "2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "active",
  });
});

afterAll(async () => {
  await purge().catch(() => undefined);
  await closeDatabase().catch(() => undefined);
});

describe("audit appends are atomic with the ledger mutation", () => {
  it("rolls back a generated voucher posting when the audit append fails", async () => {
    await installAuditFailure(TENANT);
    try {
      await expectRejectedWith(
        withTenant(TENANT, () => persistGeneratedEntry(TENANT, entry("fail-post"))),
        /audit append forced to fail/,
      );
    } finally {
      await removeAuditFailure(TENANT);
    }
    await expect(entryExists("fail-post")).resolves.toBe(false);
  });

  it("rolls back a chart-of-accounts update when the audit append fails", async () => {
    await installAuditFailure(TENANT);
    try {
      await expectRejectedWith(
        bulkSaveAccounts(TENANT, [
          { id: "acc-cash", code: "1000", name: "Cash renamed", type: "Asset" } as never,
        ]),
        /audit append forced to fail/,
      );
    } finally {
      await removeAuditFailure(TENANT);
    }
    const rows = await withTenant(TENANT, (tx) =>
      tx
        .select({ name: accountingAccounts.name })
        .from(accountingAccounts)
        .where(eq(accountingAccounts.id, "acc-cash")),
    );
    expect(rows[0]!.name).toBe("Cash");
  });

  it("rolls back an opening-balance replacement when the audit append fails", async () => {
    await installAuditFailure(TENANT);
    try {
      await expectRejectedWith(
        replaceOpeningBalances(TENANT, "fy-audit", openingRows as never, "probe"),
        /audit append forced to fail/,
      );
    } finally {
      await removeAuditFailure(TENANT);
    }
    const rows = await withTenant(TENANT, (tx) =>
      tx.select({ id: accountingOpeningBalances.id }).from(accountingOpeningBalances),
    );
    expect(rows).toEqual([]);
  });

  it("rolls back an exchange-rate save when the audit append fails", async () => {
    await installAuditFailure(TENANT);
    try {
      await expectRejectedWith(
        withTenant(TENANT, () =>
          upsertExchangeRates(exchangeRateDeps, { tenant: TENANT, userId: ACTOR_ID }, [
            {
              fromCurrency: "USD",
              toCurrency: "PKR",
              rateDate: "2026-06-30",
              rateType: "CLOSING",
              rate: "280",
            },
          ]),
        ),
        /audit append forced to fail/,
      );
    } finally {
      await removeAuditFailure(TENANT);
    }
    const rows = await withTenant(TENANT, (tx) =>
      tx.select({ id: accountingExchangeRates.id }).from(accountingExchangeRates),
    );
    expect(rows).toEqual([]);
  });

  it("rolls back a posting-period close when the audit append fails", async () => {
    const periods = await listPostingPeriods(TENANT, "fy-audit");
    const june = periods.find((row) => row.label === "2026-06");
    expect(june).toBeDefined();

    await installAuditFailure(TENANT);
    try {
      await expectRejectedWith(
        // The use case reads the ALS tenant (set by auth in production).
        runWithTenant(TENANT, () => closePostingPeriod(june!.id, ACTOR_ID, "month end")),
        /audit append forced to fail/,
      );
    } finally {
      await removeAuditFailure(TENANT);
    }
    const after = await withTenant(TENANT, (tx) =>
      tx
        .select({ status: accountingPostingPeriods.status })
        .from(accountingPostingPeriods)
        .where(eq(accountingPostingPeriods.id, june!.id)),
    );
    expect(after[0]!.status).toBe("open");
  });

  it("rolls back a posting-rules save when the audit append fails", async () => {
    const before = await withTenant(TENANT, (tx) =>
      tx
        .select()
        .from(accountingPostingRules)
        .where(eq(accountingPostingRules.workspaceSubdomain, TENANT)),
    );
    await installAuditFailure(TENANT);
    try {
      await expectRejectedWith(
        runWithTenant(TENANT, () => upsertPostingRules({ fxRoundingAccountId: "acc-income" })),
        /audit append forced to fail/,
      );
    } finally {
      await removeAuditFailure(TENANT);
    }
    const after = await withTenant(TENANT, (tx) =>
      tx
        .select()
        .from(accountingPostingRules)
        .where(eq(accountingPostingRules.workspaceSubdomain, TENANT)),
    );
    expect(after).toEqual(before);
  });

  it("rolls back a voucher reversal when the audit append fails", async () => {
    // Seed the original voucher while the probe trigger is absent.
    await withTenant(TENANT, () => persistGeneratedEntry(TENANT, entry("rev-original")));
    const actor: JournalReversalActor = { id: ACTOR_ID, name: "Auditor" };

    await installAuditFailure(TENANT);
    try {
      await expectRejectedWith(
        reverseJournalEntry(
          TENANT,
          "rev-original",
          { date: "2026-06-02", reason: "wrong account" },
          actor,
          reverseJournalEntryDeps,
        ),
        /audit append forced to fail/,
      );
    } finally {
      await removeAuditFailure(TENANT);
    }
    const reversals = await withTenant(TENANT, (tx) =>
      tx
        .select({ id: accountingEntries.id })
        .from(accountingEntries)
        .where(eq(accountingEntries.sourceType, "reversal")),
    );
    expect(reversals).toEqual([]);
    await expect(entryExists("rev-original")).resolves.toBe(true);
  });
});

describe("successful ledger mutations append exactly one attributed row", () => {
  it("records the posting, the COA change, the opening balances and the period lock", async () => {
    // Fresh families, each previously unlogged.
    await withTenant(TENANT, () => persistGeneratedEntry(TENANT, entry("ok-post")));
    await bulkSaveAccounts(TENANT, [
      { id: "acc-income", code: "4000", name: "Tuition Income", type: "Revenue" } as never,
    ]);
    await replaceOpeningBalances(TENANT, "fy-audit", openingRows as never, "initial import");
    const periods = await listPostingPeriods(TENANT, "fy-audit");
    const june = periods.find((row) => row.label === "2026-06")!;
    await runWithTenant(TENANT, () => closePostingPeriod(june.id, ACTOR_ID, "month end"));

    const postings = await auditRows("accounting_entries", "ok-post");
    expect(postings).toHaveLength(1);
    expect(postings[0]).toMatchObject({
      actionType: "CREATE",
      realUserId: ACTOR_ID,
    });
    expect(postings[0]!.newState).toContain("ok-post");
    expect(postings[0]!.hashCurrent).toBeTruthy();

    const accountRows = await auditRows("accounting_accounts", "acc-income");
    expect(accountRows.length).toBeGreaterThanOrEqual(1);
    expect(accountRows.at(-1)).toMatchObject({ actionType: "UPDATE", realUserId: ACTOR_ID });
    expect(accountRows.at(-1)!.oldState).toContain("Income");
    expect(accountRows.at(-1)!.newState).toContain("Tuition Income");

    const openingRowsAudit = await auditRows("accounting_opening_balances", "fy-audit");
    expect(openingRowsAudit).toHaveLength(1);
    expect(openingRowsAudit[0]!.newState).toContain("initial import");

    const periodRows = await auditRows("accounting_posting_periods", june.id);
    expect(periodRows.at(-1)).toMatchObject({ actionType: "UPDATE", realUserId: ACTOR_ID });
    expect(periodRows.at(-1)!.newState).toContain("month end");
  });

  it("keeps the audit chain append-only", async () => {
    await expectRejectedWith(
      withTenant(TENANT, (tx) =>
        tx.execute(
          sql`UPDATE audit_trail_events SET new_state = '{}' WHERE workspace_subdomain = ${TENANT}`,
        ),
      ),
      /append-only/,
    );

    await expectRejectedWith(
      withTenant(TENANT, (tx) =>
        tx.execute(sql`DELETE FROM audit_trail_events WHERE workspace_subdomain = ${TENANT}`),
      ),
      /append-only/,
    );
  });
});
