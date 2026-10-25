import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import {
  accountingCurrencyExchangeability,
  accountingExchangeRates,
  fxReferenceRates,
  workspaces,
} from "../../db/schema.js";
import {
  lookupExchangeRate,
  upsertExchangeRates,
} from "../../db/repositories/accountingExchangeRatesRepository.js";
import { saveCurrencyExchangeability } from "../../db/repositories/accountingCurrencyExchangeabilityRepository.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "fx-ias21-exch";
const FEED = "test-feed-exch";

async function cleanup(): Promise<void> {
  const { tx, commit, rollback } = await beginLongLivedTenantTransaction(null);
  try {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(accountingExchangeRates).where(eq(accountingExchangeRates.workspaceSubdomain, TENANT));
    await tx
      .delete(accountingCurrencyExchangeability)
      .where(eq(accountingCurrencyExchangeability.workspaceSubdomain, TENANT));
    await tx.delete(fxReferenceRates).where(eq(fxReferenceRates.provider, FEED));
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
    await commit();
  } catch (error) {
    await rollback().catch(() => undefined);
    throw error;
  }
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await cleanup();
  const { tx, commit } = await beginLongLivedTenantTransaction(null);
  await tx.insert(workspaces).values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: TENANT, enabled: true });
  await tx.insert(fxReferenceRates).values([
    { provider: FEED, baseCurrency: "PKR", quoteCurrency: "ARS", rateDate: "2026-01-10", rate: "3.5" },
    { provider: FEED, baseCurrency: "PKR", quoteCurrency: "ARS", rateDate: "2026-06-10", rate: "4.2" },
  ]);
  await commit();
  await saveCurrencyExchangeability(
    TENANT,
    {
      currencies: [
        {
          currency: "ARS",
          assessedOn: "2026-05-01",
          estimationMethod: "Observable parallel-market rate adjusted for the official spread",
          reason: "Official market closed to non-residents",
        },
      ],
    },
    null,
  );
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

const lookup = (date: string) =>
  lookupExchangeRate(TENANT, { fromCurrency: "ARS", toCurrency: "PKR", date, rateType: "SPOT" });

describe("IAS 21 lack of exchangeability", () => {
  it("given a date before the assessment, should still use the observable feed rate", async () => {
    // Arrange / Act
    const rate = await lookup("2026-03-01");

    // Assert
    expect(rate).toMatchObject({ source: `feed:${FEED}` });
  });

  it("given a date after the assessment and no estimate, should return no rate instead of the feed", async () => {
    // Arrange / Act
    const rate = await lookup("2026-07-01");

    // Assert
    expect(rate).toBeNull();
  });

  it("given an estimated spot rate, should store and return it as an estimate", async () => {
    // Arrange
    const [saved] = await upsertExchangeRates(
      TENANT,
      [{ fromCurrency: "ARS", toCurrency: "PKR", rateDate: "2026-06-30", rateType: "SPOT", rate: "0.21", overrideReason: "Parallel rate 0.20 + 5% spread" }],
      null,
    );

    // Act
    const rate = await lookup("2026-07-01");

    // Assert
    expect(saved.source).toBe("estimate");
    expect(rate).toMatchObject({ rate: "0.21", source: "estimate" });
  });
});
