/**
 * IAS 21.23 period-end revaluation: monetary balances in a foreign currency are
 * retranslated at the closing rate and the difference is an unrealized FX gain
 * or loss, posted with an automatic reversal on the next day.
 */
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { convertMoney } from "../money/fxConvert.js";
import { currencyMinorUnits } from "../money/iso4217.js";
import { moneyToDecimalString, parseMoney, subtractMoney } from "../money/money.js";
import { exchangeRateValueSchema } from "../money/moneySchemas.js";
import type { JournalLine } from "./accountingModuleManifest.js";

/** Open foreign balance of one monetary account in one currency, as of a date. */
export interface ForeignMonetaryBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  currency: string;
  /** Net debit (+) / credit (−) balance in the foreign currency (decimal string). */
  openTxn: string;
  /** Net debit (+) / credit (−) carrying amount in the functional currency. */
  carryingFunc: string;
}

export const fxRevaluationLineSchema = z
  .object({
    accountId: z.string(),
    accountCode: z.string(),
    accountName: z.string(),
    currency: z.string(),
    openTxn: z.string(),
    closingRate: exchangeRateValueSchema,
    carryingFunc: z.string(),
    revaluedFunc: z.string(),
    /** Gain (+) / loss (−) in the functional currency. */
    unrealized: z.string(),
  })
  .strict();

export type FxRevaluationLine = z.infer<typeof fxRevaluationLineSchema>;

export const fxRevaluationRunSchema = z
  .object({
    id: z.string(),
    revaluationDate: isoDateSchema,
    status: z.enum(["preview", "posted"]),
    functionalCurrency: z.string(),
    totalUnrealized: z.string(),
    entryId: z.string().nullable(),
    reversalEntryId: z.string().nullable(),
    lines: z.array(fxRevaluationLineSchema),
    createdAt: z.string().optional(),
    createdBy: z.string().nullable().optional(),
  })
  .strict();

export type FxRevaluationRun = z.infer<typeof fxRevaluationRunSchema>;

/** Body of `POST /api/accounting/fx-revaluations[/preview]`. */
export const fxRevaluationRequestSchema = z.object({ revaluationDate: isoDateSchema }).strict();

/** Raised when a currency with an open balance has no closing rate. */
export class MissingClosingRatesError extends Error {
  constructor(readonly currencies: readonly string[]) {
    super(`No closing rate on file for ${currencies.join(", ")}`);
    this.name = "MissingClosingRatesError";
  }
}

/**
 * Unrealized FX per balance: `openTxn × closingRate − carryingFunc`, rounded to
 * the functional currency. Balances whose difference is zero are dropped.
 */
export function computeFxRevaluation(
  balances: readonly ForeignMonetaryBalance[],
  closingRates: ReadonlyMap<string, string>,
  functionalCurrency: string,
): FxRevaluationLine[] {
  const missing = [...new Set(balances.map((b) => b.currency))].filter((c) => !closingRates.has(c));
  if (missing.length > 0) throw new MissingClosingRatesError(missing);
  const lines: FxRevaluationLine[] = [];
  for (const balance of balances) {
    const closingRate = closingRates.get(balance.currency) as string;
    const open = parseMoney(
      normalizeStoredAmount(balance.openTxn, balance.currency),
      balance.currency,
    );
    const carrying = parseMoney(
      normalizeStoredAmount(balance.carryingFunc, functionalCurrency),
      functionalCurrency,
    );
    const revalued = convertMoney(open, closingRate, functionalCurrency);
    const unrealized = subtractMoney(revalued, carrying);
    if (unrealized.minor === 0n) continue;
    lines.push({
      accountId: balance.accountId,
      accountCode: balance.accountCode,
      accountName: balance.accountName,
      currency: balance.currency,
      openTxn: moneyToDecimalString(open),
      closingRate,
      carryingFunc: moneyToDecimalString(carrying),
      revaluedFunc: moneyToDecimalString(revalued),
      unrealized: moneyToDecimalString(unrealized),
    });
  }
  return lines;
}

/** Round a stored `numeric(19,4)` string to the currency's own scale. */
export function normalizeStoredAmount(value: string, currency: string): string {
  const scale = currencyMinorUnits(currency);
  const [whole, fraction = ""] = value.split(".");
  const kept = fraction.slice(0, scale).padEnd(scale, "0");
  const dropped = fraction.slice(scale).replace(/0+$/, "");
  if (dropped) throw new RangeError(`Balance ${value} exceeds ${currency} precision`);
  return scale > 0 ? `${whole}.${kept}` : whole;
}

/** Sum of unrealized amounts (functional decimal string). */
export function totalUnrealized(
  lines: readonly FxRevaluationLine[],
  functionalCurrency: string,
): string {
  const total = lines.reduce(
    (sum, line) => sum + parseMoney(line.unrealized, functionalCurrency).minor,
    0n,
  );
  return moneyToDecimalString({ minor: total, currency: functionalCurrency });
}

/**
 * Journal lines for a revaluation: each account gets a functional-only
 * adjustment tagged with its foreign currency (transaction amount zero, so the
 * foreign balance is untouched), offset in aggregate on the unrealized FX account.
 */
export function buildFxRevaluationJournalLines(
  lines: readonly FxRevaluationLine[],
  unrealizedAccountId: string,
  functionalCurrency: string,
  date: string,
): JournalLine[] {
  const journal: JournalLine[] = [];
  let net = 0n;
  lines.forEach((line, index) => {
    const amount = parseMoney(line.unrealized, functionalCurrency);
    net += amount.minor;
    const magnitude = Number(
      moneyToDecimalString({ ...amount, minor: amount.minor < 0n ? -amount.minor : amount.minor }),
    );
    const zero = moneyToDecimalString(parseMoney("0", line.currency));
    journal.push({
      id: `fxr-${index + 1}`,
      account_id: line.accountId,
      debit: amount.minor > 0n ? magnitude : 0,
      credit: amount.minor < 0n ? magnitude : 0,
      description: `FX revaluation ${line.currency} @ ${line.closingRate}`,
      txn_currency: line.currency,
      txn_debit: zero,
      txn_credit: zero,
      exchange_rate: line.closingRate,
      rate_type: "CLOSING",
      rate_date: date,
    });
  });
  if (net !== 0n) {
    const magnitude = Number(
      moneyToDecimalString({ minor: net < 0n ? -net : net, currency: functionalCurrency }),
    );
    journal.push({
      id: "fxr-pl",
      account_id: unrealizedAccountId,
      debit: net < 0n ? magnitude : 0,
      credit: net > 0n ? magnitude : 0,
      description: "Unrealized FX gain/loss",
    });
  }
  return journal;
}
