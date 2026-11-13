/**
 * IAS 21 FX report: open foreign monetary exposure by currency at the closing
 * rate, realized FX booked on payments in a period, and the unrealized FX
 * posted by period-end revaluations (IFRS 7.33–34 / IAS 21.52 disclosures).
 */
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";

import { convertMoney } from "../money/fxConvert.js";
import { moneyToDecimalString, parseMoney } from "../money/money.js";
import { exchangeRateValueSchema, moneyDecimalAmountSchema } from "../money/moneySchemas.js";
import { normalizeStoredAmount, type ForeignMonetaryBalance } from "./accountingFxRevaluation.js";

/** Query of `GET /api/accounting/fx-report`. */
export const fxReportQuerySchema = z
  .object({ from: isoDateSchema, asOf: isoDateSchema })
  .strict()
  .refine((query) => query.from <= query.asOf, {
    message: "accounting.validation.fxReportRange",
    path: ["from"],
  });

export type FxReportQuery = z.infer<typeof fxReportQuerySchema>;

export interface FxExposureRow {
  currency: string;
  /** Net foreign balance (debit +), in the foreign currency. */
  openTxn: string;
  carryingFunc: string;
  /** Null when no CLOSING or SPOT rate is on file for the date. */
  closingRate: string | null;
  revaluedFunc: string | null;
  unrealized: string | null;
}

export interface FxRealizedRow {
  currency: string;
  realized: string;
  payments: number;
}

export interface FxReport {
  from: string;
  asOf: string;
  functionalCurrency: string;
  exposure: FxExposureRow[];
  realized: FxRealizedRow[];
  totalRealized: string;
  /** Posted revaluations in the period (each reverses the next day). */
  revaluations: { revaluationDate: string; totalUnrealized: string }[];
}

/** Sum stored decimal strings exactly in `currency` minor units. */
export function sumStoredAmounts(values: readonly string[], currency: string): string {
  const minor = values.reduce(
    (sum, value) => sum + parseMoney(normalizeStoredAmount(value, currency), currency).minor,
    0n,
  );
  return moneyToDecimalString({ minor, currency });
}

/** Per-currency exposure; currencies without a closing rate are reported, not valued at 1. */
export function summarizeFxExposure(
  balances: readonly ForeignMonetaryBalance[],
  closingRates: ReadonlyMap<string, string>,
  functionalCurrency: string,
): FxExposureRow[] {
  const byCurrency = new Map<string, ForeignMonetaryBalance[]>();
  for (const balance of balances) {
    byCurrency.set(balance.currency, [...(byCurrency.get(balance.currency) ?? []), balance]);
  }
  return [...byCurrency.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, rows]) => {
      const openTxn = sumStoredAmounts(
        rows.map((row) => row.openTxn),
        currency,
      );
      const carryingFunc = sumStoredAmounts(
        rows.map((row) => row.carryingFunc),
        functionalCurrency,
      );
      const closingRate = closingRates.get(currency) ?? null;
      if (!closingRate)
        return {
          currency,
          openTxn,
          carryingFunc,
          closingRate,
          revaluedFunc: null,
          unrealized: null,
        };
      const revalued = convertMoney(parseMoney(openTxn, currency), closingRate, functionalCurrency);
      const unrealized = revalued.minor - parseMoney(carryingFunc, functionalCurrency).minor;
      return {
        currency,
        openTxn,
        carryingFunc,
        closingRate,
        revaluedFunc: moneyToDecimalString(revalued),
        unrealized: moneyToDecimalString({ minor: unrealized, currency: functionalCurrency }),
      };
    });
}

/** One currency's open exposure; a currency without a closing rate is unvalued, not 1. */
export const fxExposureRowSchema = z
  .object({
    currency: z.string(),
    openTxn: moneyDecimalAmountSchema,
    carryingFunc: moneyDecimalAmountSchema,
    closingRate: exchangeRateValueSchema.nullable(),
    revaluedFunc: moneyDecimalAmountSchema.nullable(),
    unrealized: moneyDecimalAmountSchema.nullable(),
  })
  .strict();

/** Realized FX booked on payments in the window, per currency. */
export const fxRealizedRowSchema = z
  .object({
    currency: z.string(),
    realized: moneyDecimalAmountSchema,
    payments: z.number().int().min(0),
  })
  .strict();

/** Response of `GET /api/accounting/fx-report`. */
export const fxReportSchema = z
  .object({
    from: isoDateSchema,
    asOf: isoDateSchema,
    functionalCurrency: z.string(),
    exposure: z.array(fxExposureRowSchema),
    realized: z.array(fxRealizedRowSchema),
    totalRealized: moneyDecimalAmountSchema,
    revaluations: z.array(
      z
        .object({ revaluationDate: isoDateSchema, totalUnrealized: moneyDecimalAmountSchema })
        .strict(),
    ),
  })
  .strict();
