import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { ias29RunSchema, type JournalEntry, type JournalLine } from "@mms/shared";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import {
  accountingAccounts,
  accountingCurrencySettings,
  accountingEntries,
  accountingHyperinflationSettings,
  accountingIas29Runs,
  accountingJournalLines,
  accountingPriceIndices,
  workspaces,
} from "../../db/schema.js";
import { bulkSaveEntries } from "../../db/repositories/accountingEntriesPersist.js";
import { findEntryById } from "../../db/repositories/accountingRepository.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  postIas29Restatement,
  previewIas29Restatement,
  savePriceIndices,
  updateHyperinflationSettings,
} from "../../accounting/use-cases/ias29UseCases.js";
import { ias29Deps } from "../../accounting/use-cases/ias29Deps.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";
import {
  expectRejectedWith,
  installAuditFailure,
  removeAuditFailure,
} from "./auditFailureProbe.js";

const TENANT = "fx-ias29-restate";
const actor = { tenant: TENANT, userId: "u1" };

async function cleanup(): Promise<void> {
  const { tx, commit, rollback } = await beginLongLivedTenantTransaction(null, {
    allowGlobal: true,
  });
  try {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(accountingIas29Runs).where(eq(accountingIas29Runs.workspaceSubdomain, TENANT));
    await tx
      .delete(accountingPriceIndices)
      .where(eq(accountingPriceIndices.workspaceSubdomain, TENANT));
    await tx
      .delete(accountingHyperinflationSettings)
      .where(eq(accountingHyperinflationSettings.workspaceSubdomain, TENANT));
    await tx
      .delete(accountingJournalLines)
      .where(eq(accountingJournalLines.workspaceSubdomain, TENANT));
    await tx.delete(accountingEntries).where(eq(accountingEntries.workspaceSubdomain, TENANT));
    await tx.delete(accountingAccounts).where(eq(accountingAccounts.workspaceSubdomain, TENANT));
    await tx
      .delete(accountingCurrencySettings)
      .where(eq(accountingCurrencySettings.workspaceSubdomain, TENANT));
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
    await commit();
  } catch (error) {
    await rollback().catch(() => undefined);
    throw error;
  }
}

const line = (id: string, account: string, debit: number, credit: number): JournalLine => ({
  id,
  account_id: account,
  debit,
  credit,
  description: "",
});

const opening = {
  id: "je-open",
  date: "2026-01-15",
  ref: "je-open",
  description: "Opening capital",
  status: "posted",
  created_by: "t",
  tags: [],
  attachments: [],
  fiscal_year: "",
  lines: [line("l1", "cash", 400, 0), line("l2", "land", 600, 0), line("l3", "capital", 0, 1000)],
} as JournalEntry;

beforeAll(async () => {
  await requireDatabaseConnection();
  await cleanup();
  const { tx, commit } = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  await tx
    .insert(workspaces)
    .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: TENANT, enabled: true });
  await tx.insert(accountingAccounts).values([
    {
      id: "cash",
      workspaceSubdomain: TENANT,
      code: "1000",
      name: "Cash",
      type: "Asset",
      isMonetary: true,
    },
    {
      id: "land",
      workspaceSubdomain: TENANT,
      code: "1500",
      name: "Land",
      type: "Asset",
      isMonetary: false,
    },
    { id: "capital", workspaceSubdomain: TENANT, code: "3000", name: "Capital", type: "Equity" },
    {
      id: "nmp",
      workspaceSubdomain: TENANT,
      code: "7950",
      name: "Monetary gain/loss",
      type: "Expense",
    },
  ]);
  await tx
    .insert(accountingCurrencySettings)
    .values({ workspaceSubdomain: TENANT, functionalCurrency: "PKR", presentationCurrency: "PKR" });
  await commit();
  await bulkSaveEntries(TENANT, [opening]);
  await withTenant(TENANT, () =>
    savePriceIndices(ias29Deps, actor, [
      { indexDate: "2026-01-31", value: "100", source: "CPI" },
      { indexDate: "2026-12-31", value: "150", source: "CPI" },
      { indexDate: "2027-01-31", value: "165", source: "CPI" },
    ]),
  );
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

describe("IAS 29 hyperinflation restatement", () => {
  it("given restatement is switched off, should refuse to preview", async () => {
    // Arrange / Act
    const run = withTenant(TENANT, () => previewIas29Restatement(ias29Deps, TENANT, "2026-12-31"));

    // Assert
    await expect(run).rejects.toMatchObject({ statusCode: 422 });
  });

  it("given a missing gain/loss account, should reject the settings", async () => {
    // Arrange / Act
    const saved = withTenant(TENANT, () =>
      updateHyperinflationSettings(ias29Deps, actor, {
        enabled: true,
        netMonetaryAccountId: "nope",
        appliesFrom: "2026-01-01",
        indexName: "CPI",
      }),
    );

    // Assert
    await expect(saved).rejects.toMatchObject({ statusCode: 422 });
  });

  it("given 400 of cash and 50% inflation, should restate land and capital and report a 200 loss", async () => {
    // Arrange
    await withTenant(TENANT, () =>
      updateHyperinflationSettings(ias29Deps, actor, {
        enabled: true,
        netMonetaryAccountId: "nmp",
        appliesFrom: "2026-01-01",
        indexName: "CPI",
      }),
    );

    // Act
    const run = await withTenant(TENANT, () =>
      previewIas29Restatement(ias29Deps, TENANT, "2026-12-31"),
    );

    // Assert
    expect(run.netMonetaryResult).toBe("-200.00");
    expect(run.lines.map((entry) => [entry.accountId, entry.adjustment])).toEqual([
      ["land", "300.00"],
      ["capital", "-500.00"],
    ]);
  });

  it("refuses a month with activity but no price index and writes no run", async () => {
    await withTenant(TENANT, (tx) =>
      tx
        .delete(accountingPriceIndices)
        .where(
          and(
            eq(accountingPriceIndices.workspaceSubdomain, TENANT),
            eq(accountingPriceIndices.indexDate, "2026-01-31"),
          ),
        ),
    );

    await expect(
      withTenant(TENANT, () => previewIas29Restatement(ias29Deps, TENANT, "2026-12-31")),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining("price index"),
    });
    await expect(
      withTenant(TENANT, () => postIas29Restatement(ias29Deps, actor, "2026-12-31")),
    ).rejects.toMatchObject({ statusCode: 422 });

    const runs = await withTenant(TENANT, (tx) =>
      tx.$count(accountingIas29Runs, eq(accountingIas29Runs.workspaceSubdomain, TENANT)),
    );
    expect(runs).toBe(0);

    // Restore the index point so later cases restate from the original base.
    await withTenant(TENANT, () =>
      savePriceIndices(ias29Deps, actor, [
        { indexDate: "2026-01-31", value: "100", source: "CPI" },
      ]),
    );
  });

  it("given a posted restatement, should book the loss, reverse it the next day and stay idempotent", async () => {
    // Arrange / Act
    const first = await withTenant(TENANT, () =>
      postIas29Restatement(ias29Deps, actor, "2026-12-31"),
    );
    const second = await withTenant(TENANT, () =>
      postIas29Restatement(ias29Deps, actor, "2026-12-31"),
    );
    const posted = await findEntryById(TENANT, first.entryId as string);
    const reversal = await findEntryById(TENANT, first.reversalEntryId as string);

    // Assert
    expect(second.id).toBe(first.id);
    expect(second.lines).toHaveLength(2);
    expect(posted?.lines.find((entry) => entry.account_id === "nmp")).toMatchObject({
      debit: 200,
      credit: 0,
    });
    expect(reversal).toMatchObject({ date: "2027-01-01", source_type: "ias29_reversal" });
  });

  it("given an earlier restatement and its reversal, should restate the next period from historical amounts", async () => {
    // Arrange / Act
    const run = await withTenant(TENANT, () =>
      previewIas29Restatement(ias29Deps, TENANT, "2027-01-31"),
    );

    // Assert
    expect(run.netMonetaryResult).toBe("-260.00");
  });
});

describe("IAS 29 responses satisfy the route schema", () => {
  it("posts a run that validates against the declared HTTP schema", async () => {
    const run = await withTenant(TENANT, () =>
      postIas29Restatement(ias29Deps, actor, "2027-01-31"),
    );
    expect(ias29RunSchema.safeParse(run).success).toBe(true);
  });
});

describe("IAS 29 controls under concurrency and misconfiguration", () => {
  it("rejects a net monetary position account that is not P&L or equity", async () => {
    // `cash` is an Asset: the plug would land on the balance sheet instead of P&L.
    await expect(
      withTenant(TENANT, () =>
        updateHyperinflationSettings(ias29Deps, actor, {
          enabled: true,
          netMonetaryAccountId: "cash",
          appliesFrom: "2026-01-01",
          indexName: "CPI",
        }),
      ),
    ).rejects.toThrow(/expected Equity, Revenue or Expense/);
  });

  it("rolls back the restatement run and its entry pair when the audit append fails", async () => {
    await installAuditFailure(TENANT);
    try {
      await expectRejectedWith(
        withTenant(TENANT, () => postIas29Restatement(ias29Deps, actor, "2027-03-31")),
        /audit append forced to fail/,
      );
    } finally {
      await removeAuditFailure(TENANT);
    }

    const surviving = await withTenant(TENANT, (tx) =>
      tx.execute(sql`
        SELECT
          (SELECT count(*)::int FROM accounting_entries
            WHERE workspace_subdomain = ${TENANT} AND source_id = '2027-03-31'
              AND source_type IN ('ias29_restate', 'ias29_reversal')) AS entries,
          (SELECT count(*)::int FROM accounting_ias29_runs
            WHERE workspace_subdomain = ${TENANT} AND restatement_date = '2027-03-31') AS runs
      `),
    );
    expect(surviving.rows[0]).toMatchObject({ entries: 0, runs: 0 });
  });

  it("posts one restatement per date under concurrent submits", async () => {
    const [first, second] = await Promise.all([
      withTenant(TENANT, () => postIas29Restatement(ias29Deps, actor, "2027-02-28")),
      withTenant(TENANT, () => postIas29Restatement(ias29Deps, actor, "2027-02-28")),
    ]);

    expect(second.id).toBe(first.id);
    const runs = await withTenant(TENANT, (tx) =>
      tx.execute(sql`
        SELECT count(*)::int AS n FROM accounting_ias29_runs
         WHERE workspace_subdomain = ${TENANT} AND restatement_date = '2027-02-28'
      `),
    );
    expect(Number((runs.rows as Array<{ n: number }>)[0]?.n ?? 0)).toBe(1);
  });
});
