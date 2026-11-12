import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { JournalEntry, JournalLine } from "@mms/shared";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import {
  accountingAccounts,
  accountingCurrencySettings,
  accountingEnabledCurrencies,
  accountingEntries,
  accountingExchangeRates,
  accountingFxRevaluationRuns,
  accountingJournalLines,
  accountingPostingRules,
  workspaces,
} from "../../db/schema.js";
import { bulkSaveEntries } from "../../db/repositories/accountingEntriesPersist.js";
import { findEntryById } from "../../db/repositories/accountingRepository.js";
import { upsertExchangeRates } from "../../db/repositories/accountingExchangeRatesRepository.js";
import { savePostingRules } from "../../db/repositories/accountingLedgerOpsRepository.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  postFxRevaluation,
  previewFxRevaluation,
} from "../../accounting/use-cases/fxRevaluationUseCases.js";
import { fxReportDeps, fxRevaluationDeps } from "../../accounting/use-cases/fxRevaluationDeps.js";
import { buildFxReport } from "../../accounting/use-cases/fxReportUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "fx-ias21-reval";

async function cleanup(): Promise<void> {
  const { tx, commit, rollback } = await beginLongLivedTenantTransaction(null, {
    allowGlobal: true,
  });
  try {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx
      .delete(accountingFxRevaluationRuns)
      .where(eq(accountingFxRevaluationRuns.workspaceSubdomain, TENANT));
    await tx
      .delete(accountingJournalLines)
      .where(eq(accountingJournalLines.workspaceSubdomain, TENANT));
    await tx.delete(accountingEntries).where(eq(accountingEntries.workspaceSubdomain, TENANT));
    await tx
      .delete(accountingPostingRules)
      .where(eq(accountingPostingRules.workspaceSubdomain, TENANT));
    await tx.delete(accountingAccounts).where(eq(accountingAccounts.workspaceSubdomain, TENANT));
    await tx
      .delete(accountingExchangeRates)
      .where(eq(accountingExchangeRates.workspaceSubdomain, TENANT));
    await tx
      .delete(accountingEnabledCurrencies)
      .where(eq(accountingEnabledCurrencies.workspaceSubdomain, TENANT));
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

const foreign = (
  id: string,
  account: string,
  side: "debit" | "credit",
  ccy: string,
  txn: string,
  rate: string,
  func: number,
): JournalLine => ({
  id,
  account_id: account,
  debit: side === "debit" ? func : 0,
  credit: side === "credit" ? func : 0,
  description: "",
  txn_currency: ccy,
  txn_debit: side === "debit" ? txn : "0.00",
  txn_credit: side === "credit" ? txn : "0.00",
  exchange_rate: rate,
  rate_type: "SPOT",
  rate_date: "2026-11-01",
});

const entry = (id: string, lines: JournalLine[]): JournalEntry =>
  ({
    id,
    date: "2026-11-01",
    ref: id,
    description: "",
    status: "posted",
    created_by: "t",
    tags: [],
    attachments: [],
    fiscal_year: "",
    lines,
  }) as JournalEntry;

beforeAll(async () => {
  await requireDatabaseConnection();
  await cleanup();
  const { tx, commit } = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  await tx
    .insert(workspaces)
    .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: TENANT, enabled: true });
  await tx.insert(accountingAccounts).values([
    {
      id: "ar",
      workspaceSubdomain: TENANT,
      code: "1100",
      name: "Fee Receivable",
      type: "Asset",
      isMonetary: true,
    },
    {
      id: "inv",
      workspaceSubdomain: TENANT,
      code: "1300",
      name: "Inventory",
      type: "Asset",
      isMonetary: false,
    },
    { id: "inc", workspaceSubdomain: TENANT, code: "4000", name: "Fee Income", type: "Revenue" },
    { id: "fx", workspaceSubdomain: TENANT, code: "7900", name: "Unrealized FX", type: "Revenue" },
  ]);
  await tx
    .insert(accountingCurrencySettings)
    .values({ workspaceSubdomain: TENANT, functionalCurrency: "PKR", presentationCurrency: "PKR" });
  await tx.insert(accountingEnabledCurrencies).values([
    { workspaceSubdomain: TENANT, currency: "USD" },
    { workspaceSubdomain: TENANT, currency: "EUR" },
  ]);
  await commit();
  await savePostingRules(TENANT, { fxUnrealizedAccountId: "fx" });
  await bulkSaveEntries(TENANT, [
    entry("je-ar", [
      foreign("l1", "ar", "debit", "USD", "1000.00", "280", 280000),
      foreign("l2", "inc", "credit", "USD", "1000.00", "280", 280000),
    ]),
    entry("je-inv", [
      foreign("l1", "inv", "debit", "EUR", "100.00", "300", 30000),
      foreign("l2", "inc", "credit", "EUR", "100.00", "300", 30000),
    ]),
  ]);
  await upsertExchangeRates(
    TENANT,
    [
      {
        fromCurrency: "USD",
        toCurrency: "PKR",
        rateDate: "2026-11-30",
        rateType: "CLOSING",
        rate: "283",
      },
      {
        fromCurrency: "EUR",
        toCurrency: "PKR",
        rateDate: "2026-11-30",
        rateType: "CLOSING",
        rate: "310",
      },
    ],
    null,
  );
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

describe("IAS 21 period-end revaluation", () => {
  it("given USD receivables and EUR inventory, should revalue only the monetary USD balance", async () => {
    // Arrange / Act
    const run = await withTenant(TENANT, () =>
      previewFxRevaluation(fxRevaluationDeps, TENANT, "2026-11-30"),
    );

    // Assert
    expect(run.lines).toEqual([
      expect.objectContaining({
        accountId: "ar",
        currency: "USD",
        openTxn: "1000.00",
        unrealized: "3000.00",
      }),
    ]);
    expect(run.totalUnrealized).toBe("3000.00");
  });

  it("given a posted revaluation, should book the gain, reverse it the next day and stay idempotent", async () => {
    // Arrange / Act
    const first = await withTenant(TENANT, () =>
      postFxRevaluation(fxRevaluationDeps, { tenant: TENANT, userId: "u1" }, "2026-11-30"),
    );
    const second = await withTenant(TENANT, () =>
      postFxRevaluation(fxRevaluationDeps, { tenant: TENANT, userId: "u1" }, "2026-11-30"),
    );
    const posted = await findEntryById(TENANT, first.entryId as string);
    const reversal = await findEntryById(TENANT, first.reversalEntryId as string);

    // Assert
    expect(second.id).toBe(first.id);
    expect(posted?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          account_id: "ar",
          debit: 3000,
          txn_currency: "USD",
          txn_debit: "0.00",
        }),
        expect.objectContaining({ account_id: "fx", credit: 3000 }),
      ]),
    );
    expect(reversal?.date).toBe("2026-12-01");
    expect(reversal?.lines).toEqual(
      expect.arrayContaining([expect.objectContaining({ account_id: "ar", credit: 3000 })]),
    );
  });

  it("given the revaluation and its reversal, should leave the next period carrying the booked amount", async () => {
    // Arrange / Act
    const nextMonth = await withTenant(TENANT, () =>
      previewFxRevaluation(fxRevaluationDeps, TENANT, "2026-12-01"),
    );

    // Assert: after the reversal the USD AR is back at 280,000, so at 283 the gain is 3,000 again.
    expect(nextMonth.lines[0]).toMatchObject({ carryingFunc: "280000.00", unrealized: "3000.00" });
  });

  it("given the posted revaluation, should report USD exposure at the closing rate and the run in the period", async () => {
    // Arrange / Act
    const report = await withTenant(TENANT, () =>
      buildFxReport(fxReportDeps, TENANT, { from: "2026-11-01", asOf: "2026-11-30" }),
    );

    // Assert: on 30 Nov the revaluation is in, so the USD AR is carried at 283 with nothing left unrealized.
    expect(report.exposure).toEqual([
      {
        currency: "USD",
        openTxn: "1000.00",
        carryingFunc: "283000.00",
        closingRate: "283",
        revaluedFunc: "283000.00",
        unrealized: "0.00",
      },
    ]);
    expect(report.revaluations).toEqual([
      { revaluationDate: "2026-11-30", totalUnrealized: "3000.00" },
    ]);
    expect(report).toMatchObject({
      realized: [],
      totalRealized: "0.00",
      functionalCurrency: "PKR",
    });
  });
});

describe("revaluation posting is idempotent under concurrency and refuses bad money", () => {
  it("posts one run and one entry set for concurrent submits of the same date", async () => {
    const [first, second] = await Promise.all([
      withTenant(TENANT, () =>
        postFxRevaluation(fxRevaluationDeps, { tenant: TENANT, userId: "u1" }, "2026-12-31"),
      ),
      withTenant(TENANT, () =>
        postFxRevaluation(fxRevaluationDeps, { tenant: TENANT, userId: "u1" }, "2026-12-31"),
      ),
    ]);

    expect(second.id).toBe(first.id);
    const runs = await withTenant(TENANT, (tx) =>
      tx.execute(sql`
        SELECT count(*)::int AS n FROM accounting_fx_revaluation_runs
         WHERE workspace_subdomain = ${TENANT} AND revaluation_date = '2026-12-31'
      `),
    );
    expect(Number((runs.rows as Array<{ n: number }>)[0]?.n ?? 0)).toBe(1);
    const entries = await withTenant(TENANT, (tx) =>
      tx.execute(sql`
        SELECT count(*)::int AS n FROM accounting_entries
         WHERE workspace_subdomain = ${TENANT}
           AND source_type = 'fx_reval' AND source_id = '2026-12-31'
      `),
    );
    expect(Number((entries.rows as Array<{ n: number }>)[0]?.n ?? 0)).toBe(1);
  });

  it("turns a legacy balance with more decimals than the currency into a 422", async () => {
    // Pre-guard data: numeric(19,4) can hold 1000.1234 USD, which is not money.
    await withTenant(TENANT, async (tx) => {
      await tx.insert(accountingAccounts).values({
        id: "ar2",
        workspaceSubdomain: TENANT,
        code: "1101",
        name: "Legacy receivable",
        type: "Asset",
        isMonetary: true,
      });
      await tx.insert(accountingEntries).values({
        id: "je-legacy-scale",
        workspaceSubdomain: TENANT,
        date: "2026-11-01",
        ref: "LEGACY-SCALE",
        description: "",
        status: "posted",
        createdBy: "t",
        fiscalYear: "",
      });
      await tx.insert(accountingJournalLines).values([
        {
          id: "legacy-d",
          workspaceSubdomain: TENANT,
          entryId: "je-legacy-scale",
          accountId: "ar2",
          debit: "280.00",
          credit: "0",
          txnCurrency: "USD",
          txnDebit: "1000.1234",
          txnCredit: "0",
          exchangeRate: "280",
          funcDebit: "280.00",
          funcCredit: "0",
          description: "",
        },
        {
          id: "legacy-c",
          workspaceSubdomain: TENANT,
          entryId: "je-legacy-scale",
          accountId: "inc",
          debit: "0",
          credit: "280.00",
          txnCurrency: "USD",
          txnDebit: "0",
          txnCredit: "1000.1234",
          exchangeRate: "280",
          funcDebit: "0",
          funcCredit: "280.00",
          description: "",
        },
      ]);
    });

    await expect(
      withTenant(TENANT, () => previewFxRevaluation(fxRevaluationDeps, TENANT, "2027-01-31")),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
