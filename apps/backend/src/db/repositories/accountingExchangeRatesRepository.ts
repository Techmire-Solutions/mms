import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  crossExchangeRate,
  invertExchangeRate,
  type ExchangeRateListQuery,
  type ExchangeRateLookupQuery,
  type ExchangeRateLookupResult,
  type ExchangeRatePutItem,
  type ExchangeRateRecord,
  type ExchangeRateType,
} from "@mms/shared";
import { accountingExchangeRates, fxReferenceRates } from "../schema.js";
import { withTenant, withTenantRead, type TenantTransaction } from "../tenant-context.js";
import { canonicalStoredRate } from "./repositoryFxMappers.js";

/** Feed rates are daily spot fixings, so they can only answer these rate types. */
const FEED_RATE_TYPES: readonly ExchangeRateType[] = ["SPOT", "CLOSING"];

const rateColumns = {
  id: accountingExchangeRates.id,
  fromCurrency: accountingExchangeRates.fromCurrency,
  toCurrency: accountingExchangeRates.toCurrency,
  rateDate: accountingExchangeRates.rateDate,
  rateType: accountingExchangeRates.rateType,
  rate: accountingExchangeRates.rate,
  source: accountingExchangeRates.source,
  overrideReason: accountingExchangeRates.overrideReason,
  createdAt: accountingExchangeRates.createdAt,
  createdBy: accountingExchangeRates.createdBy,
};

type RateRow = Omit<typeof accountingExchangeRates.$inferSelect, "workspaceSubdomain">;

function rateRowToRecord(row: RateRow): ExchangeRateRecord {
  return {
    ...row,
    rateType: row.rateType as ExchangeRateType,
    rate: canonicalStoredRate(row.rate),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listExchangeRates(
  tenant: string,
  query: ExchangeRateListQuery,
): Promise<ExchangeRateRecord[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const conditions = [eq(accountingExchangeRates.workspaceSubdomain, subdomain)];
    if (query.fromCurrency) conditions.push(eq(accountingExchangeRates.fromCurrency, query.fromCurrency));
    if (query.toCurrency) conditions.push(eq(accountingExchangeRates.toCurrency, query.toCurrency));
    if (query.rateType) conditions.push(eq(accountingExchangeRates.rateType, query.rateType));
    if (query.dateFrom) conditions.push(gte(accountingExchangeRates.rateDate, query.dateFrom));
    if (query.dateTo) conditions.push(lte(accountingExchangeRates.rateDate, query.dateTo));
    const rows = await tx
      .select(rateColumns)
      .from(accountingExchangeRates)
      .where(and(...conditions))
      .orderBy(desc(accountingExchangeRates.rateDate), accountingExchangeRates.fromCurrency)
      .limit(query.limit ?? 200);
    return rows.map(rateRowToRecord);
  });
}

/** Upsert by (from, to, date, type); a changed rate keeps the row id and records the reason. */
export async function upsertExchangeRates(
  tenant: string,
  items: readonly ExchangeRatePutItem[],
  userId: string | null,
): Promise<ExchangeRateRecord[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .insert(accountingExchangeRates)
      .values(
        items.map((item) => ({
          id: randomUUID(),
          workspaceSubdomain: subdomain,
          fromCurrency: item.fromCurrency,
          toCurrency: item.toCurrency,
          rateDate: item.rateDate,
          rateType: item.rateType,
          rate: item.rate,
          source: "manual",
          overrideReason: item.overrideReason ?? "",
          createdBy: userId,
        })),
      )
      .onConflictDoUpdate({
        target: [
          accountingExchangeRates.workspaceSubdomain,
          accountingExchangeRates.fromCurrency,
          accountingExchangeRates.toCurrency,
          accountingExchangeRates.rateDate,
          accountingExchangeRates.rateType,
        ],
        set: {
          rate: sql`excluded.rate`,
          source: sql`excluded.source`,
          overrideReason: sql`excluded.override_reason`,
          createdBy: sql`excluded.created_by`,
          createdAt: new Date(),
        },
      })
      .returning(rateColumns);
    return rows.map(rateRowToRecord);
  });
}

async function latestTenantRate(
  tx: TenantTransaction,
  subdomain: string,
  from: string,
  to: string,
  query: ExchangeRateLookupQuery,
) {
  const [row] = await tx
    .select({ rate: accountingExchangeRates.rate, rateDate: accountingExchangeRates.rateDate })
    .from(accountingExchangeRates)
    .where(
      and(
        eq(accountingExchangeRates.workspaceSubdomain, subdomain),
        eq(accountingExchangeRates.fromCurrency, from),
        eq(accountingExchangeRates.toCurrency, to),
        eq(accountingExchangeRates.rateType, query.rateType),
        lte(accountingExchangeRates.rateDate, query.date),
      ),
    )
    .orderBy(desc(accountingExchangeRates.rateDate))
    .limit(1);
  return row ? { rate: canonicalStoredRate(row.rate), rateDate: row.rateDate } : null;
}

async function feedRate(tx: TenantTransaction, query: ExchangeRateLookupQuery) {
  if (!FEED_RATE_TYPES.includes(query.rateType)) return null;
  const { fromCurrency: from, toCurrency: to } = query;
  const rows = await tx
    .selectDistinctOn([fxReferenceRates.provider, fxReferenceRates.quoteCurrency], {
      provider: fxReferenceRates.provider,
      base: fxReferenceRates.baseCurrency,
      quote: fxReferenceRates.quoteCurrency,
      rate: fxReferenceRates.rate,
      rateDate: fxReferenceRates.rateDate,
    })
    .from(fxReferenceRates)
    .where(and(inArray(fxReferenceRates.quoteCurrency, [from, to]), lte(fxReferenceRates.rateDate, query.date)))
    .orderBy(fxReferenceRates.provider, fxReferenceRates.quoteCurrency, desc(fxReferenceRates.rateDate));

  for (const provider of new Set(rows.map((row) => row.provider))) {
    const quotes = rows.filter((row) => row.provider === provider);
    const base = quotes[0].base;
    const quoteOf = (code: string) =>
      code === base
        ? { rate: "1", rateDate: query.date }
        : (quotes.find((row) => row.quote === code) ?? null);
    const fromQuote = quoteOf(from);
    const toQuote = quoteOf(to);
    if (!fromQuote || !toQuote) continue;
    return {
      rate: crossExchangeRate(canonicalStoredRate(fromQuote.rate), canonicalStoredRate(toQuote.rate)),
      rateDate: fromQuote.rateDate < toQuote.rateDate ? fromQuote.rateDate : toQuote.rateDate,
      source: `feed:${provider}`,
    };
  }
  return null;
}

/**
 * The rate in force on `query.date` (latest on or before it): a tenant rate,
 * then the inverse of a tenant rate, then the reference feed triangulated via
 * its base currency. Null when nothing applies — callers must fail, never use 1.
 */
export async function lookupExchangeRate(
  tenant: string,
  query: ExchangeRateLookupQuery,
): Promise<ExchangeRateLookupResult | null> {
  const subdomain = tenant.trim().toLowerCase();
  const { fromCurrency, toCurrency, rateType } = query;
  if (fromCurrency === toCurrency) {
    return { fromCurrency, toCurrency, rate: "1", rateDate: query.date, rateType, source: "identity" };
  }
  return withTenantRead(subdomain, async (tx) => {
    const direct = await latestTenantRate(tx, subdomain, fromCurrency, toCurrency, query);
    if (direct) return { fromCurrency, toCurrency, rateType, source: "manual", ...direct };
    const inverse = await latestTenantRate(tx, subdomain, toCurrency, fromCurrency, query);
    if (inverse) {
      return {
        fromCurrency,
        toCurrency,
        rateType,
        source: "manual:inverse",
        rate: invertExchangeRate(inverse.rate),
        rateDate: inverse.rateDate,
      };
    }
    const feed = await feedRate(tx, query);
    return feed ? { fromCurrency, toCurrency, rateType, ...feed } : null;
  });
}
