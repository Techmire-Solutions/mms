/**
 * IAS 21 journal-line resolution: every line carries its transaction-currency
 * amount and the functional-currency amount derived from an explicit rate.
 * `debit`/`credit` remain the functional amounts the ledger balances on.
 */
import { convertMoney } from "../money/fxConvert.js";
import { currencyMinorUnits } from "../money/iso4217.js";
import { moneyFromMinor, moneyToDecimalString, parseMoney, type Money } from "../money/money.js";
import type { JournalLine } from "./accountingModuleManifest.js";

/** Raised when a foreign-currency line has no rate; posting must never assume 1. */
export class MissingExchangeRateError extends Error {
  constructor(
    readonly fromCurrency: string,
    readonly toCurrency: string,
    readonly rateDate: string,
  ) {
    super(`No exchange rate for ${fromCurrency}→${toCurrency} on or before ${rateDate}`);
    this.name = "MissingExchangeRateError";
  }
}

/** Raised when a line breaks an IAS 21 rule (bad amount, wrong account currency, …). */
export class JournalFxLineError extends Error {
  constructor(
    message: string,
    readonly lineId: string,
  ) {
    super(message);
    this.name = "JournalFxLineError";
  }
}

export interface JournalFxContext {
  functionalCurrency: string;
  /** Posting date; used as the rate date for lines that do not carry one. */
  entryDate: string;
  /** Account that absorbs a functional rounding residue on multi-currency entries. */
  roundingAccountId?: string | null;
  /** Account id → locked currency (`accounting_accounts.account_currency`). */
  accountCurrencies?: ReadonlyMap<string, string | null>;
}

/** Functional currencies the number-based ledger DTOs can carry exactly (≤ 2 decimals). */
export function isSupportedFunctionalCurrency(code: string): boolean {
  return currencyMinorUnits(code) <= 2;
}

const toFunctionalNumber = (money: Money): number => Number(moneyToDecimalString(money));

const functionalFromNumber = (value: number, currency: string): Money =>
  parseMoney(value.toFixed(currencyMinorUnits(currency)), currency);

function resolveLine(line: JournalLine, ctx: JournalFxContext): JournalLine {
  const functional = ctx.functionalCurrency;
  const txnCurrency = line.txn_currency ?? functional;
  const locked = ctx.accountCurrencies?.get(line.account_id);
  if (locked && locked !== txnCurrency) {
    throw new JournalFxLineError(
      `Account ${line.account_id} only accepts ${locked} lines (got ${txnCurrency})`,
      line.id,
    );
  }
  if (txnCurrency === functional) {
    const debit = functionalFromNumber(line.debit, functional);
    const credit = functionalFromNumber(line.credit, functional);
    return {
      ...line,
      txn_currency: functional,
      txn_debit: moneyToDecimalString(debit),
      txn_credit: moneyToDecimalString(credit),
      exchange_rate: "1",
      rate_type: line.rate_type ?? "SPOT",
      rate_date: line.rate_date ?? ctx.entryDate,
    };
  }
  if (!line.exchange_rate) {
    throw new MissingExchangeRateError(txnCurrency, functional, line.rate_date ?? ctx.entryDate);
  }
  let txnDebit: Money;
  let txnCredit: Money;
  try {
    txnDebit = parseMoney(line.txn_debit ?? "0", txnCurrency);
    txnCredit = parseMoney(line.txn_credit ?? "0", txnCurrency);
  } catch {
    throw new JournalFxLineError(`Line amount does not fit ${txnCurrency} precision`, line.id);
  }
  return {
    ...line,
    txn_currency: txnCurrency,
    txn_debit: moneyToDecimalString(txnDebit),
    txn_credit: moneyToDecimalString(txnCredit),
    rate_type: line.rate_type ?? "SPOT",
    rate_date: line.rate_date ?? ctx.entryDate,
    debit: toFunctionalNumber(convertMoney(txnDebit, line.exchange_rate, functional)),
    credit: toFunctionalNumber(convertMoney(txnCredit, line.exchange_rate, functional)),
  };
}

/**
 * Resolve every line's functional amount. On an entry with foreign-currency
 * lines, a functional imbalance of at most one minor unit per line is posted to
 * the rounding account so the entry balances; larger gaps are left for the
 * balance check to reject.
 */
export function resolveJournalFxLines(
  lines: readonly JournalLine[],
  ctx: JournalFxContext,
): JournalLine[] {
  const resolved = lines.map((line) => resolveLine(line, ctx));
  const functional = ctx.functionalCurrency;
  if (!resolved.some((line) => line.txn_currency !== functional)) return resolved;

  let residue = 0n;
  for (const line of resolved) {
    residue +=
      functionalFromNumber(line.debit, functional).minor -
      functionalFromNumber(line.credit, functional).minor;
  }
  if (residue === 0n) return resolved;
  const tolerance = BigInt(resolved.length);
  if ((residue < 0n ? -residue : residue) > tolerance) return resolved;
  if (!ctx.roundingAccountId) {
    throw new JournalFxLineError("No FX rounding account is configured in posting rules", "");
  }
  const amount = moneyFromMinor(residue < 0n ? -residue : residue, functional);
  const value = moneyToDecimalString(amount);
  return [
    ...resolved,
    {
      id: "fx-rounding",
      account_id: ctx.roundingAccountId,
      debit: residue < 0n ? Number(value) : 0,
      credit: residue > 0n ? Number(value) : 0,
      description: "FX rounding",
      txn_currency: functional,
      txn_debit: residue < 0n ? value : moneyToDecimalString(moneyFromMinor(0n, functional)),
      txn_credit: residue > 0n ? value : moneyToDecimalString(moneyFromMinor(0n, functional)),
      exchange_rate: "1",
      rate_type: "SPOT",
      rate_date: ctx.entryDate,
    },
  ];
}
