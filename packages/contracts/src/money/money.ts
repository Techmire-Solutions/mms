/**
 * Exact money arithmetic: amounts are BigInt minor units tagged with an ISO 4217
 * currency. Values cross the wire as decimal strings, never as JS floats.
 */
import { currencyMinorUnits } from "./iso4217.js";

/** How a value that falls between two minor units is resolved. */
export type RoundingMode = "half-up" | "half-even";

/** An exact amount in the currency's minor units (cents, fils, yen…). */
export interface Money {
  readonly minor: bigint;
  readonly currency: string;
}

/** Raised when arithmetic mixes two currencies without an explicit conversion. */
export class CurrencyMismatchError extends Error {
  constructor(
    readonly left: string,
    readonly right: string,
  ) {
    super(`Cannot combine ${left} with ${right} without an exchange rate`);
    this.name = "CurrencyMismatchError";
  }
}

/** Raised when a decimal string is malformed or carries more decimals than allowed. */
export class InvalidMoneyStringError extends Error {
  constructor(
    readonly value: string,
    readonly currency: string,
  ) {
    super(`Invalid ${currency} amount: ${value}`);
    this.name = "InvalidMoneyStringError";
  }
}

const DECIMAL_STRING = /^(-)?(\d+)(?:\.(\d+))?$/;

export const pow10 = (exponent: number): bigint => 10n ** BigInt(exponent);

/**
 * Integer division of `numerator / denominator` (denominator > 0) rounded with
 * `mode`; ties round away from zero for half-up and to the even neighbour for
 * half-even.
 */
export function divideRounded(
  numerator: bigint,
  denominator: bigint,
  mode: RoundingMode = "half-up",
): bigint {
  if (denominator <= 0n) throw new RangeError("divideRounded: denominator must be positive");
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  let quotient = absolute / denominator;
  const twiceRemainder = (absolute % denominator) * 2n;
  if (
    twiceRemainder > denominator ||
    (twiceRemainder === denominator && (mode === "half-up" || quotient % 2n === 1n))
  ) {
    quotient += 1n;
  }
  return negative ? -quotient : quotient;
}

/** Build a Money from minor units. */
export function moneyFromMinor(minor: bigint, currency: string): Money {
  currencyMinorUnits(currency);
  return { minor, currency };
}

/** Zero in `currency`. */
export function zeroMoney(currency: string): Money {
  return moneyFromMinor(0n, currency);
}

/**
 * Parse a decimal string such as "1250.5" into exact minor units. Rejects more
 * fraction digits than the currency allows instead of rounding them away.
 */
export function parseMoney(value: string, currency: string): Money {
  const scale = currencyMinorUnits(currency);
  const match = DECIMAL_STRING.exec(value.trim());
  if (!match) throw new InvalidMoneyStringError(value, currency);
  const [, sign, whole, fraction = ""] = match;
  if (fraction.length > scale) throw new InvalidMoneyStringError(value, currency);
  const minor = BigInt(whole + fraction.padEnd(scale, "0"));
  return { minor: sign ? -minor : minor, currency };
}

/** True when `value` parses as an amount of `currency` without losing precision. */
export function isValidMoneyString(value: string, currency: string): boolean {
  try {
    parseMoney(value, currency);
    return true;
  } catch {
    return false;
  }
}

/** Render `money` as a plain decimal string with exactly the currency's scale. */
export function moneyToDecimalString(money: Money): string {
  const scale = currencyMinorUnits(money.currency);
  const negative = money.minor < 0n;
  const digits = (negative ? -money.minor : money.minor).toString().padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  const fraction = scale > 0 ? `.${digits.slice(digits.length - scale)}` : "";
  return `${negative ? "-" : ""}${whole}${fraction}`;
}

function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new CurrencyMismatchError(left.currency, right.currency);
  }
}

/** `left + right`; throws CurrencyMismatchError across currencies. */
export function addMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return { minor: left.minor + right.minor, currency: left.currency };
}

/** `left − right`; throws CurrencyMismatchError across currencies. */
export function subtractMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return { minor: left.minor - right.minor, currency: left.currency };
}

/** `−money`. */
export function negateMoney(money: Money): Money {
  return { minor: -money.minor, currency: money.currency };
}

/** Sum of `amounts`, all in `currency` (zero for an empty list). */
export function sumMoney(amounts: readonly Money[], currency: string): Money {
  return amounts.reduce(addMoney, zeroMoney(currency));
}

/** −1, 0 or 1 comparing `left` to `right` in the same currency. */
export function compareMoney(left: Money, right: Money): -1 | 0 | 1 {
  assertSameCurrency(left, right);
  if (left.minor === right.minor) return 0;
  return left.minor < right.minor ? -1 : 1;
}

/** True when `money` is exactly zero. */
export function isZeroMoney(money: Money): boolean {
  return money.minor === 0n;
}

/**
 * Split `total` across `weights` so the parts always sum back to `total` exactly
 * (largest-remainder method). Used to release a booked amount pro rata.
 */
export function allocateMoney(total: Money, weights: readonly bigint[]): Money[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0n);
  if (weights.length === 0 || weightSum <= 0n || weights.some((weight) => weight < 0n)) {
    throw new RangeError("allocateMoney: weights must be non-negative with a positive sum");
  }
  const sign = total.minor < 0n ? -1n : 1n;
  const absolute = total.minor * sign;
  const shares = weights.map((weight) => (absolute * weight) / weightSum);
  let leftover = absolute - shares.reduce((sum, share) => sum + share, 0n);
  const byRemainder = weights
    .map((weight, index) => ({ index, remainder: (absolute * weight) % weightSum }))
    .sort((a, b) => {
      if (a.remainder === b.remainder) return a.index - b.index;
      return a.remainder > b.remainder ? -1 : 1;
    });
  for (const { index } of byRemainder) {
    if (leftover === 0n) break;
    shares[index] += 1n;
    leftover -= 1n;
  }
  return shares.map((share) => ({ minor: share * sign, currency: total.currency }));
}
