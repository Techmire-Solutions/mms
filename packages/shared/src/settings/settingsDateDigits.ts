import type { DateNumberFormatter } from "../core/dateFormatUtils.js";
import { formatIntlInteger, normalizeIntlDigits } from "../core/intlDigits.js";

export { normalizeIntlDigits };

export function parseDatePart(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(normalizeIntlDigits(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Locale-aware integer formatter used for the day/month/year pieces. */
export function createDateNumberFormatter(locale: string): DateNumberFormatter {
  return (value, minimumIntegerDigits) => formatIntlInteger(value, minimumIntegerDigits, locale);
}

/** Generic app dates are Gregorian; Hijri dates use the dedicated helper. */
export const GREGORIAN_CALENDAR = "gregory" as const;
