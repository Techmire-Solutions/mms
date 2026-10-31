import {
  convertMoney,
  currencyMinorUnits,
  moneyToDecimalString,
  parseMoney,
  previewConvertedAmount,
  type JournalLine,
} from "@mms/shared";
import type { DraftLine } from "./journalEntryFormTypes";

/** Transaction currency of a stored entry: its lines' currency, else the functional one. */
export function entryCurrencyFromLines(
  lines: readonly Pick<JournalLine, "txn_currency">[],
  functionalCurrency: string,
): string {
  return lines.find((line) => line.txn_currency)?.txn_currency ?? functionalCurrency;
}

/** The rate a stored foreign entry was booked at (first foreign line). */
export function entryRateFromLines(
  lines: readonly Pick<JournalLine, "txn_currency" | "exchange_rate">[],
  functionalCurrency: string,
): string {
  const foreign = lines.find(
    (line) => line.txn_currency && line.txn_currency !== functionalCurrency,
  );
  return foreign?.exchange_rate ?? "";
}

const blankZero = (value: string | undefined): string =>
  value && Number(value) !== 0 ? value : "";

/**
 * Draft lines for the form: a foreign entry is edited in its transaction
 * currency, so the amount boxes show `txn_*` instead of the functional figures.
 */
export function draftLinesFromEntry(
  lines: readonly JournalLine[],
  functionalCurrency: string,
): DraftLine[] {
  return lines.map((line) =>
    line.txn_currency && line.txn_currency !== functionalCurrency
      ? { ...line, debit: blankZero(line.txn_debit), credit: blankZero(line.txn_credit) }
      : { ...line, debit: line.debit || "", credit: line.credit || "" },
  );
}

const toTxnString = (amount: number, currency: string): string =>
  moneyToDecimalString(parseMoney(amount.toFixed(currencyMinorUnits(currency)), currency));

const toFunctional = (txn: string, currency: string, rate: string, functional: string): number =>
  Number(moneyToDecimalString(convertMoney(parseMoney(txn, currency), rate, functional)));

/**
 * Stamp lines entered in `currency` with IAS 21 fields. Functional-currency
 * entries drop any stale FX fields (the server books them at rate 1); foreign
 * entries carry their transaction amounts and rate, and `debit`/`credit` become
 * the functional preview the server will recompute and verify.
 */
export function applyEntryCurrency<T extends JournalLine>(
  lines: readonly T[],
  currency: string,
  functionalCurrency: string,
  rate: string,
): T[] {
  if (currency === functionalCurrency) {
    return lines.map((line) => {
      const rest = { ...line };
      delete rest.txn_currency;
      delete rest.txn_debit;
      delete rest.txn_credit;
      delete rest.exchange_rate;
      delete rest.rate_type;
      delete rest.rate_date;
      return rest;
    });
  }
  return lines.map((line) => {
    const txnDebit = toTxnString(line.debit, currency);
    const txnCredit = toTxnString(line.credit, currency);
    return {
      ...line,
      txn_currency: currency,
      txn_debit: txnDebit,
      txn_credit: txnCredit,
      exchange_rate: rate,
      debit: toFunctional(txnDebit, currency, rate, functionalCurrency),
      credit: toFunctional(txnCredit, currency, rate, functionalCurrency),
    };
  });
}

/** Functional equivalent of a transaction-currency total, or null without a usable rate. */
export function functionalPreview(
  total: number,
  currency: string,
  functionalCurrency: string,
  rate: string,
): number | null {
  return previewConvertedAmount(total, currency, functionalCurrency, rate);
}
