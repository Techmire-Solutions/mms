/**
 * Zod schemas for money on the wire: ISO 4217 codes, decimal-string amounts and
 * exchange rates. Amounts are strings so no float ever crosses an API boundary.
 */
import { z } from "zod";
import { EXCHANGE_RATE_TYPES, isValidExchangeRate } from "./fxConvert.js";
import { isIsoCurrencyCode } from "./iso4217.js";
import { isValidMoneyString } from "./money.js";

/** An active ISO 4217 alphabetic code, e.g. "PKR". */
export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, { message: "accounting.validation.currencyCode" })
  .refine(isIsoCurrencyCode, { message: "accounting.validation.currencyCode" });

/**
 * A signed decimal amount string with up to four decimals (the `numeric(19,4)`
 * storage scale). Pair with `refineMoneyForCurrency` to enforce the currency's
 * own minor units once the currency is known.
 */
export const moneyDecimalAmountSchema = z
  .string()
  .regex(/^-?\d{1,15}(\.\d{1,4})?$/, { message: "accounting.validation.moneyDecimal" });

/** A non-negative decimal amount string (see `moneyDecimalAmountSchema`). */
export const nonNegativeMoneyDecimalAmountSchema = moneyDecimalAmountSchema.refine(
  (value) => !value.startsWith("-"),
  { message: "accounting.validation.moneyNonNegative" },
);

/** A positive exchange rate string with at most ten decimals (`numeric(20,10)`). */
export const exchangeRateValueSchema = z
  .string()
  .refine(isValidExchangeRate, { message: "accounting.validation.exchangeRate" });

export const exchangeRateTypeSchema = z.enum(EXCHANGE_RATE_TYPES);

/** An amount tagged with its currency: `{ amount: "1250.50", currency: "PKR" }`. */
export const moneyValueSchema = z
  .object({ amount: moneyDecimalAmountSchema, currency: currencyCodeSchema })
  .strict()
  .superRefine((value, ctx) =>
    refineMoneyForCurrency(value.amount, value.currency, ctx, ["amount"]),
  );

/**
 * Adds an issue when `amount` carries more decimals than `currency` allows
 * (e.g. "10.5" for JPY). Use inside an object schema's `superRefine`.
 */
export function refineMoneyForCurrency(
  amount: string,
  currency: string,
  ctx: z.RefinementCtx,
  path: (string | number)[],
): void {
  if (!isIsoCurrencyCode(currency)) return;
  if (!isValidMoneyString(amount, currency)) {
    ctx.addIssue({ code: "custom", message: "accounting.validation.moneyScale", path });
  }
}

export type MoneyValue = z.infer<typeof moneyValueSchema>;
