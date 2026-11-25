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

/**
 * A non-negative **number** amount that is exactly representable in integer cents.
 *
 * Legacy DTOs still carry money as a JS number (the DB adapters convert at the boundary).
 * Such a value must round-trip through integer cents exactly: more than two decimals is
 * silently rounded by a `numeric(p,2)` column, and beyond 2^53 cents `Number` drops a cent.
 * Use this instead of a bare `z.number().min(0)` until the DTO moves to
 * {@link nonNegativeMoneyDecimalAmountSchema}.
 */
export const moneyNumberAmountSchema = z
  .number()
  .finite()
  .min(0)
  .refine((value) => Math.abs(value - Math.round(value * 100) / 100) < 1e-9, {
    message: "accounting.validation.moneyScale",
  })
  .refine((value) => Number.isSafeInteger(Math.round(value * 100)), {
    message: "accounting.validation.moneyDecimal",
  });

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
 * Converts a money value to a display number **without a float parse**.
 *
 * Accepts a finite number, or a decimal string with at most two fraction digits; both are taken
 * apart digit by digit and reassembled as integer cents before dividing, so `"0.1"` and `"0.2"`
 * can never produce `0.30000000000000004`. Returns `null` for anything else (`""`, `"abc"`,
 * `"1.005"`, `NaN`, `Infinity`, or cents beyond 2^53 where a number cannot represent them).
 *
 * Display-only: persistence must keep the exact decimal string / integer cents.
 */
export function toMoneyNumber(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // Re-assemble through cents so a float like 1.005 is refused rather than silently rounded.
    const cents = Math.round(value * 100);
    return Math.abs(cents) <= Number.MAX_SAFE_INTEGER && Math.abs(cents / 100 - value) < 1e-9
      ? cents / 100
      : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = /^(-?)(\d{1,15})(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const whole = Number.parseInt(match[2] ?? "0", 10);
  const fraction = (match[3] ?? "").padEnd(2, "0");
  const cents = whole * 100 + Number.parseInt(fraction, 10);
  if (Math.abs(cents) > Number.MAX_SAFE_INTEGER) return null;
  return (sign * cents) / 100;
}

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
