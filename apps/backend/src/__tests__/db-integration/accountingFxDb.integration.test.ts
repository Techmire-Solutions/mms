import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { JournalEntry } from "@mms/shared";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import {
  accountingAccounts,
  accountingCurrencySettings,
  accountingEnabledCurrencies,
  accountingEntries,
  accountingExchangeRates,
  accountingJournalLines,
  fxReferenceRates,
  workspaces,
} from "../../db/schema.js";
import { bulkSaveEntries } from "../../db/repositories/accountingEntriesPersist.js";
import { findEntryById } from "../../db/repositories/accountingRepository.js";
import {
  lookupExchangeRate,
  upsertExchangeRates,
} from "../../db/repositories/accountingExchangeRatesRepository.js";
import { getCurrencySettings } from "../../db/repositories/accountingCurrencySettingsRepository.js";
import { runMigration091 } from "../../db/migrations/091_backfill_functional_currency.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "fx-ias21-a";
const OTHER = "fx-ias21-b";
const FEED = "test-feed-ias21";

async function cleanup(): Promise<void> {
  const { tx, commit, rollback } = await beginLongLivedTenantTransaction(null);
  try {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    for (const tenant of [TENANT, OTHER]) {
      await tx
        .delete(accountingJournalLines)
        .where(eq(accountingJournalLines.workspaceSubdomain, tenant));
      await tx.delete(accountingEntries).where(eq(accountingEntries.workspaceSubdomain, tenant));
      await tx.delete(accountingAccounts).where(eq(accountingAccounts.workspaceSubdomain, tenant));
      await tx
        .delete(accountingExchangeRates)
        .where(eq(accountingExchangeRates.workspaceSubdomain, tenant));
      await tx
        .delete(accountingEnabledCurrencies)
        .where(eq(accountingEnabledCurrencies.workspaceSubdomain, tenant));
      await tx
        .delete(accountingCurrencySettings)
        .where(eq(accountingCurrencySettings.workspaceSubdomain, tenant));
      await tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
    }
    await tx.delete(fxReferenceRates).where(eq(fxReferenceRates.provider, FEED));
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
  for (const tenant of [TENANT, OTHER]) {
    await tx
      .insert(workspaces)
      .values({ id: `ws-${tenant}`, subdomain: tenant, madrasaName: tenant, enabled: true });
  }
  await tx.insert(accountingAccounts).values([
    { id: "ar", workspaceSubdomain: TENANT, code: "1100", name: "Fee Receivable", type: "Asset" },
    { id: "inc", workspaceSubdomain: TENANT, code: "4000", name: "Fee Income", type: "Revenue" },
  ]);
  await commit();
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

const baseEntry = (id: string, lines: JournalEntry["lines"]): JournalEntry =>
  ({
    id,
    date: "2026-10-01",
    ref: id,
    description: "",
    status: "posted",
    created_by: "test",
    tags: [],
    attachments: [],
    fiscal_year: "",
    lines,
  }) as JournalEntry;

describe("IAS 21 ledger persistence", () => {
  it("given a USD entry, should store transaction and functional amounts and hydrate them back", async () => {
    // Arrange
    const entry = baseEntry("je-usd", [
      {
        id: "l1",
        account_id: "ar",
        debit: 280000,
        credit: 0,
        description: "",
        txn_currency: "USD",
        txn_debit: "1000.00",
        txn_credit: "0.00",
        exchange_rate: "280",
        rate_type: "SPOT",
        rate_date: "2026-10-01",
      },
      {
        id: "l2",
        account_id: "inc",
        debit: 0,
        credit: 280000,
        description: "",
        txn_currency: "USD",
        txn_debit: "0.00",
        txn_credit: "1000.00",
        exchange_rate: "280",
        rate_type: "SPOT",
        rate_date: "2026-10-01",
      },
    ]);

    // Act
    await bulkSaveEntries(TENANT, [entry]);
    const stored = await findEntryById(TENANT, "je-usd");

    // Assert
    expect(stored?.lines.find((l) => l.id === "l1")).toMatchObject({
      debit: 280000,
      txn_currency: "USD",
      txn_debit: "1000.00",
      exchange_rate: "280",
    });
  });

  it("given a line without FX fields, should book it in the functional currency at rate 1", async () => {
    // Arrange
    const entry = baseEntry("je-pkr", [
      { id: "l1", account_id: "ar", debit: 500.5, credit: 0, description: "" },
      { id: "l2", account_id: "inc", debit: 0, credit: 500.5, description: "" },
    ]);

    // Act
    await bulkSaveEntries(TENANT, [entry]);
    const stored = await findEntryById(TENANT, "je-pkr");

    // Assert
    expect(stored?.lines.find((l) => l.id === "l1")).toMatchObject({
      txn_currency: "PKR",
      txn_debit: "500.50",
      exchange_rate: "1",
    });
    expect((await getCurrencySettings(TENANT)).functionalCurrency).toBe("PKR");
  });

  it("given pre-IAS 21 rows, should backfill them without changing the trial balance and be idempotent", async () => {
    // Arrange
    const { tx, commit } = await beginLongLivedTenantTransaction(null);
    await tx.execute(sql`UPDATE accounting_journal_lines SET txn_currency = NULL, txn_debit = NULL,
      txn_credit = NULL, exchange_rate = NULL, func_debit = NULL, func_credit = NULL
      WHERE workspace_subdomain = ${TENANT} AND entry_id = 'je-pkr'`);
    await commit();

    // Act
    await runMigration091();
    await runMigration091();
    const [after] = await findEntryById(TENANT, "je-pkr").then((e) => e?.lines ?? []);

    // Assert
    expect(after).toMatchObject({ txn_currency: "PKR", txn_debit: "500.50", exchange_rate: "1" });
  });
});

describe("exchange rate lookup", () => {
  it("given tenant and feed rates, should prefer the tenant rate, invert it, then triangulate the feed", async () => {
    // Arrange
    await upsertExchangeRates(
      TENANT,
      [
        {
          fromCurrency: "USD",
          toCurrency: "PKR",
          rateDate: "2026-09-30",
          rateType: "SPOT",
          rate: "281",
        },
      ],
      null,
    );
    const { tx, commit } = await beginLongLivedTenantTransaction(null);
    await tx.insert(fxReferenceRates).values([
      {
        provider: FEED,
        baseCurrency: "EUR",
        quoteCurrency: "USD",
        rateDate: "2026-09-29",
        rate: "1.08",
      },
      {
        provider: FEED,
        baseCurrency: "EUR",
        quoteCurrency: "GBP",
        rateDate: "2026-09-29",
        rate: "0.84",
      },
    ]);
    await commit();
    const lookup = (fromCurrency: string, toCurrency: string, date = "2026-10-01") =>
      lookupExchangeRate(TENANT, { fromCurrency, toCurrency, date, rateType: "SPOT" });

    // Act
    const direct = await lookup("USD", "PKR");
    const inverse = await lookup("PKR", "USD");
    const triangulated = await lookup("GBP", "USD");
    const tooEarly = await lookup("USD", "PKR", "2026-09-01");

    // Assert
    expect(direct).toMatchObject({ rate: "281", rateDate: "2026-09-30", source: "manual" });
    expect(inverse).toMatchObject({ rate: "0.0035587189", source: "manual:inverse" });
    expect(triangulated).toMatchObject({ rate: "1.2857142857", source: `feed:${FEED}` });
    expect(tooEarly).toBeNull();
  });

  it("given another workspace, should not see this tenant's rates", async () => {
    // Arrange / Act
    const result = await lookupExchangeRate(OTHER, {
      fromCurrency: "USD",
      toCurrency: "PKR",
      date: "2026-10-01",
      rateType: "SPOT",
    });

    // Assert
    expect(result).toBeNull();
  });
});
