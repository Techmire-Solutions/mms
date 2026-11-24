/**
 * Exchange-rate arithmetic (IAS 21): convert Money between currencies with an
 * explicit rate, invert rates and triangulate through a base currency.
 */
import { currencyMinorUnits } from "./iso4217.js";
import { divideRounded, pow10, type Money, type RoundingMode } from "./money.js";

/** Decimal places kept for stored and derived exchange rates (`numeric(20,10)`). */
export const EXCHANGE_RATE_SCALE = 10;

/** How a rate is used: spot on the transaction date, period average, closing, … */
export const EXCHANGE_RATE_TYPES = ["SPOT", "AVERAGE", "CLOSING", "HISTORICAL", "TAX"] as const;

export type ExchangeRateType = (typeof EXCHANGE_RATE_TYPES)[number];

/** Raised when a rate string is malformed, zero or negative. */
export class InvalidExchangeRateError extends Error {
  constructor(readonly value: string) {
    super(`Invalid exchange rate: ${value}`);
    this.name = "InvalidExchangeRateError";
  }
}

interface ScaledRate {
  numerator: bigint;
  scale: number;
}

const RATE_STRING = /^(\d+)(?:\.(\d+))?$/;

function parseRate(rate: string): ScaledRate {
  const match = RATE_STRING.exec(rate.trim());
  if (!match) throw new InvalidExchangeRateError(rate);
  const [, whole, fraction = ""] = match;
  if (fraction.length > EXCHANGE_RATE_SCALE) throw new InvalidExchangeRateError(rate);
  const numerator = BigInt(whole + fraction);
  if (numerator <= 0n) throw new InvalidExchangeRateError(rate);
  return { numerator, scale: fraction.length };
}

function formatScaledRate(value: bigint): string {
  const digits = value.toString().padStart(EXCHANGE_RATE_SCALE + 1, "0");
  const whole = digits.slice(0, digits.length - EXCHANGE_RATE_SCALE);
  const fraction = digits.slice(digits.length - EXCHANGE_RATE_SCALE).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

/**
 * `a − b` for two positive exchange rates, signed, canonical at
 * {@link EXCHANGE_RATE_SCALE} decimals.
 *
 * Needed wherever a **difference of rates** is the economic quantity: a forward's
 * fair value is `notional × (market − contract)`, and converting the two rates
 * separately and subtracting the rounded results (the previous approach) leaves the
 * value up to one functional minor unit away from the exact one. Converting the
 * delta once keeps a single rounding step.
 */
export function rateDifference(a: string, b: string): string {
  const left = parseRate(a);
  const right = parseRate(b);
  const scale = Math.max(left.scale, right.scale);
  const delta =
    left.numerator * pow10(scale - left.scale) - right.numerator * pow10(scale - right.scale);
  const scaled = delta * pow10(EXCHANGE_RATE_SCALE - scale);
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled).toString().padStart(EXCHANGE_RATE_SCALE + 1, "0");
  const whole = digits.slice(0, digits.length - EXCHANGE_RATE_SCALE);
  const fraction = digits.slice(digits.length - EXCHANGE_RATE_SCALE).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/** True when `rate` is a positive decimal string with at most 10 decimals. */
export function isValidExchangeRate(rate: string): boolean {
  try {
    parseRate(rate);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert `money` into `toCurrency` using `rate` (units of `toCurrency` per one
 * unit of `money.currency`), rounded to the target currency's minor units.
 * Same-currency conversion requires no rate and returns `money` unchanged.
 */
export function convertMoney(
  money: Money,
  rate: string,
  toCurrency: string,
  mode: RoundingMode = "half-up",
): Money {
  if (money.currency === toCurrency) return money;
  const { numerator, scale } = parseRate(rate);
  const fromScale = currencyMinorUnits(money.currency);
  const toScale = currencyMinorUnits(toCurrency);
  const minor = divideRounded(
    money.minor * numerator * pow10(toScale),
    pow10(fromScale + scale),
    mode,
  );
  return { minor, currency: toCurrency };
}

/** `1 / rate`, rounded half-up to EXCHANGE_RATE_SCALE decimals. */
export function invertExchangeRate(rate: string): string {
  const { numerator, scale } = parseRate(rate);
  return formatScaledRate(divideRounded(pow10(scale + EXCHANGE_RATE_SCALE), numerator));
}

/**
 * Cross rate FROM→TO derived from two rates quoted against the same base
 * (`baseToFrom` = FROM per BASE, `baseToTo` = TO per BASE).
 */
export function crossExchangeRate(baseToFrom: string, baseToTo: string): string {
  const from = parseRate(baseToFrom);
  const to = parseRate(baseToTo);
  return formatScaledRate(
    divideRounded(
      to.numerator * pow10(from.scale + EXCHANGE_RATE_SCALE),
      from.numerator * pow10(to.scale),
    ),
  );
}

/**
 * Display helper for forms: `amount` (a two-decimal number in `fromCurrency`)
 * converted at `rate`, or null when the rate is not usable yet. Same-currency
 * amounts pass through.
 */
export function previewConvertedAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: string,
): number | null {
  if (fromCurrency === toCurrency) return amount;
  if (!isValidExchangeRate(rate)) return null;
  const minor = currencyMinorUnits(fromCurrency);
  const money = { minor: BigInt(Math.round(amount * 10 ** minor)), currency: fromCurrency };
  const converted = convertMoney(money, rate, toCurrency);
  return Number(converted.minor) / 10 ** currencyMinorUnits(toCurrency);
}

/**
 * Exact decimal-string equality for exchange rates (up to ten decimals).
 *
 * `Number(a) !== Number(b)` loses precision at the tenth decimal, so a payment edit
 * guard built on it could either miss a real rate change or invent one. Normalize
 * the decimal text (leading zeros, trailing fractional zeros) and compare.
 */
export function exchangeRateStringsEqual(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
): boolean {
  const normalize = (value: string | number | null | undefined): string | null => {
    if (value === null || value === undefined) return null;
    // A malformed numeric update must still be *detected* as a change, never throw.
    const trimmed = (typeof value === "number" ? String(value) : value).trim();
    if (!trimmed) return null;
    const negative = trimmed.startsWith("-");
    const unsigned = trimmed.replace(/^[+-]/, "");
    const [wholeRaw = "", fractionRaw = ""] = unsigned.split(".");
    const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
    const fraction = fractionRaw.replace(/0+$/, "");
    const body = fraction ? `${whole}.${fraction}` : whole;
    return negative && body !== "0" ? `-${body}` : body;
  };
  return normalize(left) === normalize(right);
}
