import { crossExchangeRate } from "@mms/contracts";
import { canonicalStoredRate } from "./repositoryFxMappers.js";

/** One feed quote per (provider, base, quote) as returned by the lookup select. */
export interface FeedQuoteRow {
  provider: string;
  base: string;
  quote: string;
  rate: string;
  rateDate: string;
}

/**
 * Pick the first (provider, base) group in which both legs resolve, so a
 * provider whose quotes span multiple base currencies never yields a cross rate
 * computed across different bases.
 */
export function resolveFeedCrossRate(
  from: string,
  to: string,
  rows: readonly FeedQuoteRow[],
  queryDate: string,
): { rate: string; rateDate: string; source: string } | null {
  for (const provider of [...new Set(rows.map((row) => row.provider))]) {
    const providerRows = rows.filter((row) => row.provider === provider);
    for (const base of [...new Set(providerRows.map((row) => row.base))]) {
      const quotes = providerRows.filter((row) => row.base === base);
      const quoteOf = (code: string) =>
        code === base
          ? { rate: "1", rateDate: queryDate }
          : (quotes.find((row) => row.quote === code) ?? null);
      const fromQuote = quoteOf(from);
      const toQuote = quoteOf(to);
      if (!fromQuote || !toQuote) continue;
      return {
        rate: crossExchangeRate(
          canonicalStoredRate(fromQuote.rate),
          canonicalStoredRate(toQuote.rate),
        ),
        rateDate: fromQuote.rateDate < toQuote.rateDate ? fromQuote.rateDate : toQuote.rateDate,
        source: `feed:${provider}`,
      };
    }
  }
  return null;
}
