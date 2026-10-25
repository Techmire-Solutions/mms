import {
  JournalFxLineError,
  MissingExchangeRateError,
  dedupeTrimmedIds,
  resolveJournalFxLines,
  type JournalEntry,
  type JournalLine,
} from "@mms/shared";
import type { AccountingRepository } from "../repository/accountingRepository.js";
import { ledgerError } from "./accountingLedgerGuards.js";

const rateKey = (currency: string, date: string) => `${currency}|${date}`;

/**
 * Resolve IAS 21 amounts for entries about to be saved: default each foreign
 * line's rate from the rate table (latest SPOT on or before the line date),
 * enforce enabled and account-locked currencies, derive functional amounts and
 * absorb rounding. A missing rate fails the write with 422 — never a rate of 1.
 */
export async function resolveEntriesFx(
  repo: AccountingRepository,
  tenant: string,
  entries: readonly JournalEntry[],
): Promise<JournalEntry[]> {
  const fx = repo.fx;
  if (!fx) return [...entries];
  const settings = await fx.getCurrencySettings(tenant);
  const functional = settings.functionalCurrency;
  const allowed = new Set([functional, ...settings.enabledCurrencies]);
  const isForeign = (line: JournalLine) => !!line.txn_currency && line.txn_currency !== functional;

  const rates = new Map<string, string>();
  for (const entry of entries) {
    for (const line of entry.lines ?? []) {
      if (!isForeign(line)) continue;
      const currency = line.txn_currency as string;
      if (!allowed.has(currency)) {
        throw ledgerError(`Currency ${currency} is not enabled for this workspace`);
      }
      if (line.exchange_rate) continue;
      const date = line.rate_date ?? entry.date;
      const key = rateKey(currency, date);
      if (rates.has(key)) continue;
      const found = await fx.lookupExchangeRate(tenant, {
        fromCurrency: currency,
        toCurrency: functional,
        date,
        rateType: line.rate_type ?? "SPOT",
      });
      if (!found)
        throw ledgerError(new MissingExchangeRateError(currency, functional, date).message);
      rates.set(key, found.rate);
    }
  }

  const accountIds = dedupeTrimmedIds(
    entries.flatMap((entry) => (entry.lines ?? []).map((line) => line.account_id)),
  );
  const accounts = accountIds.length > 0 ? await repo.findAccountsByIds(tenant, accountIds) : [];
  const accountCurrencies = new Map(accounts.map((a) => [a.id, a.accountCurrency ?? null]));
  const hasForeign = entries.some((entry) => (entry.lines ?? []).some(isForeign));
  const roundingAccountId = hasForeign ? await fx.findFxRoundingAccountId(tenant) : null;

  return entries.map((entry) => {
    const lines = (entry.lines ?? []).map((line) =>
      isForeign(line) && !line.exchange_rate
        ? {
            ...line,
            exchange_rate: rates.get(
              rateKey(line.txn_currency as string, line.rate_date ?? entry.date),
            ),
          }
        : line,
    );
    try {
      return {
        ...entry,
        lines: resolveJournalFxLines(lines, {
          functionalCurrency: functional,
          entryDate: entry.date,
          roundingAccountId,
          accountCurrencies,
        }),
      };
    } catch (error) {
      if (error instanceof JournalFxLineError || error instanceof MissingExchangeRateError) {
        throw ledgerError(error.message);
      }
      throw error;
    }
  });
}
