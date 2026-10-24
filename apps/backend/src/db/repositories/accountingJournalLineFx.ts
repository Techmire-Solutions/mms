import {
  moneyToDecimalString,
  parseMoney,
  type ExchangeRateType,
  type JournalLine,
} from "@mms/shared";
import { accountingJournalLines } from "../schema.js";

/** IAS 21 columns selected alongside every journal line. */
export const journalLineFxColumns = {
  txnCurrency: accountingJournalLines.txnCurrency,
  txnDebit: accountingJournalLines.txnDebit,
  txnCredit: accountingJournalLines.txnCredit,
  exchangeRate: accountingJournalLines.exchangeRate,
  rateType: accountingJournalLines.rateType,
  rateDate: accountingJournalLines.rateDate,
};

export interface JournalLineFxRow {
  txnCurrency?: string | null;
  txnDebit?: string | null;
  txnCredit?: string | null;
  exchangeRate?: string | null;
  rateType?: string | null;
  rateDate?: string | null;
}

const trimZeros = (value: string): string =>
  value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;

/** `numeric(19,4)` text ("1000.0000") → the currency's canonical scale ("1000.00"). */
const storedMoney = (value: string | null | undefined, currency: string): string =>
  moneyToDecimalString(parseMoney(trimZeros(value ?? "0"), currency));

/** DTO fields for a stored line; empty for rows written before the IAS 21 backfill. */
export function journalLineFxToRecord(row: JournalLineFxRow): Partial<JournalLine> {
  if (!row.txnCurrency) return {};
  return {
    txn_currency: row.txnCurrency,
    txn_debit: storedMoney(row.txnDebit, row.txnCurrency),
    txn_credit: storedMoney(row.txnCredit, row.txnCurrency),
    ...(row.exchangeRate ? { exchange_rate: trimZeros(row.exchangeRate) } : {}),
    ...(row.rateType ? { rate_type: row.rateType as ExchangeRateType } : {}),
    ...(row.rateDate ? { rate_date: row.rateDate } : {}),
  };
}

/**
 * IAS 21 column values for an inserted line. A line that arrives without FX
 * fields (system postings, older clients) is booked in the functional currency
 * at rate 1, so no row is ever written with a NULL transaction currency.
 */
export function journalLineFxInsertValues(
  line: JournalLine,
  functionalCurrency: string,
  entryDate: string,
) {
  const debit = String(line.debit ?? 0);
  const credit = String(line.credit ?? 0);
  const foreign = line.txn_currency && line.txn_currency !== functionalCurrency;
  return {
    txnCurrency: line.txn_currency ?? functionalCurrency,
    txnDebit: foreign ? (line.txn_debit ?? "0") : debit,
    txnCredit: foreign ? (line.txn_credit ?? "0") : credit,
    exchangeRate: foreign ? (line.exchange_rate ?? null) : "1",
    rateType: line.rate_type ?? "SPOT",
    rateDate: line.rate_date ?? entryDate,
    funcDebit: debit,
    funcCredit: credit,
  };
}
