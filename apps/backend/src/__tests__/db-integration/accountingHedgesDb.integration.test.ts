import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  hedgeRelationshipRecordSchema,
  hedgeValuationRecordSchema,
  type HedgeRelationshipCreate,
} from "@mms/shared";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import {
  accountingAccounts,
  accountingCurrencySettings,
  accountingEnabledCurrencies,
  accountingEntries,
  accountingExchangeRates,
  accountingHedgeRelationships,
  accountingJournalLines,
  workspaces,
} from "../../db/schema.js";
import { findEntryById } from "../../db/repositories/accountingRepository.js";
import { upsertExchangeRates } from "../../db/repositories/accountingExchangeRatesRepository.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  createHedgeRelationship,
  postHedgeValuation,
  hedgeRecordId,
  previewHedgeValuation,
} from "../../accounting/use-cases/hedgeUseCases.js";
import {
  reclassifyHedgeReserve,
  settleHedge,
} from "../../accounting/use-cases/hedgeSettlementUseCases.js";
import { hedgeDeps } from "../../accounting/use-cases/hedgeDeps.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "fx-ifrs9-hedge";
const actor = { tenant: TENANT, userId: "u1" };

async function cleanup(): Promise<void> {
  const { tx, commit, rollback } = await beginLongLivedTenantTransaction(null, {
    allowGlobal: true,
  });
  try {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx
      .delete(accountingHedgeRelationships)
      .where(eq(accountingHedgeRelationships.workspaceSubdomain, TENANT));
    await tx
      .delete(accountingJournalLines)
      .where(eq(accountingJournalLines.workspaceSubdomain, TENANT));
    await tx.delete(accountingEntries).where(eq(accountingEntries.workspaceSubdomain, TENANT));
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

const designation: HedgeRelationshipCreate = {
  name: "January book import",
  hedgeType: "cash_flow",
  direction: "buy",
  currency: "USD",
  notional: "1000",
  contractRate: "283",
  designationRate: "285",
  designationDate: "2026-10-01",
  maturityDate: "2027-01-31",
  hedgedItem: "Forecast USD purchase of textbooks",
  riskManagementObjective: "Fix the PKR cost of the January import",
  instrumentAccountId: "deriv",
  reserveAccountId: "cfhr",
  pnlAccountId: "hpl",
};

beforeAll(async () => {
  await requireDatabaseConnection();
  await cleanup();
  const { tx, commit } = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  await tx
    .insert(workspaces)
    .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: TENANT, enabled: true });
  await tx.insert(accountingAccounts).values([
    {
      id: "deriv",
      workspaceSubdomain: TENANT,
      code: "1450",
      name: "Derivative",
      type: "Asset",
      isMonetary: true,
    },
    {
      id: "cash",
      workspaceSubdomain: TENANT,
      code: "1000",
      name: "Bank",
      type: "Asset",
      isMonetary: true,
    },
    {
      id: "cfhr",
      workspaceSubdomain: TENANT,
      code: "3500",
      name: "Cash flow hedge reserve",
      type: "Equity",
    },
    {
      id: "hpl",
      workspaceSubdomain: TENANT,
      code: "7960",
      name: "Hedge ineffectiveness",
      type: "Revenue",
    },
    {
      id: "cost",
      workspaceSubdomain: TENANT,
      code: "5100",
      name: "Books expense",
      type: "Expense",
    },
  ]);
  await tx
    .insert(accountingCurrencySettings)
    .values({ workspaceSubdomain: TENANT, functionalCurrency: "PKR", presentationCurrency: "PKR" });
  await tx
    .insert(accountingEnabledCurrencies)
    .values({ workspaceSubdomain: TENANT, currency: "USD" });
  await commit();
  await upsertExchangeRates(
    TENANT,
    [
      {
        fromCurrency: "USD",
        toCurrency: "PKR",
        rateDate: "2026-11-30",
        rateType: "CLOSING",
        rate: "290",
      },
    ],
    null,
  );
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

describe("IFRS 9 cash flow hedge of a forecast USD purchase", () => {
  it("given an over-hedge at the closing rate, should split OCI and P&L, reverse next day and stay idempotent", async () => {
    // Arrange
    const hedge = await withTenant(TENANT, () =>
      createHedgeRelationship(hedgeDeps, actor, designation),
    );

    // Act
    const valued = await withTenant(TENANT, () =>
      postHedgeValuation(hedgeDeps, actor, hedge.id, "2026-11-30"),
    );
    const again = await withTenant(TENANT, () =>
      postHedgeValuation(hedgeDeps, actor, hedge.id, "2026-11-30"),
    );
    const [record] = valued.valuations;
    const entry = await findEntryById(TENANT, record.entryId as string);
    const reversal = await findEntryById(TENANT, record.reversalEntryId as string);

    // Assert
    expect(again.valuations).toHaveLength(1);
    expect(record).toMatchObject({
      instrumentValue: "7000",
      effective: "5000",
      ineffective: "2000",
    });
    expect(entry?.lines.map((line) => [line.account_id, line.debit, line.credit]).sort()).toEqual([
      ["cfhr", 0, 5000],
      ["deriv", 7000, 0],
      ["hpl", 0, 2000],
    ]);
    expect(reversal).toMatchObject({ date: "2026-12-01", source_type: "hedge_val_rev" });
  });

  it("given settlement on or before the last valuation, should refuse it", async () => {
    // Arrange
    const [hedge] = await withTenant(TENANT, () => hedgeDeps.store.listHedgeRelationships(TENANT));

    // Act
    const settle = withTenant(TENANT, () =>
      settleHedge(hedgeDeps, actor, hedge.id, {
        settlementDate: "2026-11-30",
        settlementRate: "292",
        cashAccountId: "cash",
      }),
    );

    // Assert
    await expect(settle).rejects.toMatchObject({ statusCode: 422 });
  });

  it("given cash settlement and a later reclassification, should move the reserve into profit or loss", async () => {
    // Arrange
    const [hedge] = await withTenant(TENANT, () => hedgeDeps.store.listHedgeRelationships(TENANT));

    // Act
    const settled = await withTenant(TENANT, () =>
      settleHedge(hedgeDeps, actor, hedge.id, {
        settlementDate: "2027-01-31",
        settlementRate: "292",
        cashAccountId: "cash",
      }),
    );
    const reclassified = await withTenant(TENANT, () =>
      reclassifyHedgeReserve(hedgeDeps, actor, hedge.id, {
        date: "2027-02-15",
        targetAccountId: "cost",
      }),
    );
    const settlement = settled.valuations.find((record) => record.kind === "settlement");
    const reclass = await findEntryById(
      TENANT,
      reclassified.valuations.find((record) => record.kind === "reclassification")
        ?.entryId as string,
    );

    // Assert
    expect(settled).toMatchObject({ status: "settled", settledReserve: "7000" });
    expect(settlement).toMatchObject({
      instrumentValue: "9000",
      effective: "7000",
      ineffective: "2000",
    });
    expect(reclassified.status).toBe("reclassified");
    expect(reclass?.lines.map((line) => [line.account_id, line.debit, line.credit]).sort()).toEqual(
      [
        ["cfhr", 7000, 0],
        ["cost", 0, 7000],
      ],
    );
  });
});

describe("hedge responses satisfy the route schema", () => {
  it("emits a relationship that validates against the declared HTTP schema", async () => {
    const created = await withTenant(TENANT, () =>
      createHedgeRelationship(hedgeDeps, actor, {
        ...designation,
        name: "Schema-checked hedge",
        designationDate: "2026-12-01",
        maturityDate: "2027-04-30",
      }),
    );

    // The route validates this payload before sending; a mapper change that drops
    // a key or emits a non-canonical amount must fail here, not in production.
    expect(hedgeRelationshipRecordSchema.safeParse(created).success).toBe(true);

    // The preview returns the full valuation record under `{ valuation }`.
    const preview = await withTenant(TENANT, () =>
      previewHedgeValuation(hedgeDeps, TENANT, created.id, "2026-12-31"),
    );
    expect(hedgeValuationRecordSchema.safeParse(preview).success).toBe(true);
  });
});

describe("hedge designation and postings are guarded", () => {
  it("rejects an account whose role does not match its type", async () => {
    // The FK proves the account exists; the role proves the statement it lands on.
    await expect(
      withTenant(TENANT, () =>
        createHedgeRelationship(hedgeDeps, actor, { ...designation, pnlAccountId: "cfhr" }),
      ),
    ).rejects.toThrow(/expected Revenue or Expense/);
    await expect(
      withTenant(TENANT, () =>
        createHedgeRelationship(hedgeDeps, actor, { ...designation, reserveAccountId: "hpl" }),
      ),
    ).rejects.toThrow(/expected Equity/);
  });

  it("turns a notional that does not fit the currency into a 422, not a 500", async () => {
    // The HTTP schema rejects this now; a row stored before that guard must still
    // fail as a validation error rather than crashing the valuation.
    const { tx, commit } = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    await tx.insert(accountingHedgeRelationships).values({
      id: "hedge-legacy-scale",
      workspaceSubdomain: TENANT,
      ...designation,
      notional: "1000.1234",
    });
    await commit();

    await expect(
      withTenant(TENANT, () =>
        previewHedgeValuation(hedgeDeps, TENANT, "hedge-legacy-scale", "2026-11-30"),
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("posts one valuation per hedge and date even under concurrent submits", async () => {
    const hedge = await withTenant(TENANT, () =>
      createHedgeRelationship(hedgeDeps, actor, {
        ...designation,
        name: "Concurrent valuation hedge",
        designationDate: "2026-11-01",
        maturityDate: "2027-03-31",
        contractRate: "284",
        designationRate: "285",
      }),
    );

    const [first, second] = await Promise.all([
      withTenant(TENANT, () => postHedgeValuation(hedgeDeps, actor, hedge.id, "2026-12-15")),
      withTenant(TENANT, () => postHedgeValuation(hedgeDeps, actor, hedge.id, "2026-12-15")),
    ]);

    const valuations = [first, second].map(
      (result) =>
        result.valuations.filter((record) => record.valuationDate === "2026-12-15").length,
    );
    expect(valuations).toEqual([1, 1]);

    const stored = await withTenant(TENANT, (tx) =>
      tx.execute(sql`
        SELECT count(*)::int AS n FROM accounting_hedge_valuations
         WHERE workspace_subdomain = ${TENANT}
           AND relationship_id = ${hedge.id}
           AND valuation_date = '2026-12-15'
           AND kind = 'valuation'
      `),
    );
    expect(Number((stored.rows as Array<{ n: number }>)[0]?.n ?? 0)).toBe(1);

    const entries = await withTenant(TENANT, (tx) =>
      tx.execute(sql`
        SELECT count(*)::int AS n FROM accounting_entries
         WHERE workspace_subdomain = ${TENANT}
           AND source_type = 'hedge_val'
           AND source_id = ${hedgeRecordId(hedge.id, "valuation", "2026-12-15")}
      `),
    );
    expect(Number((entries.rows as Array<{ n: number }>)[0]?.n ?? 0)).toBe(1);
  });
});
