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
