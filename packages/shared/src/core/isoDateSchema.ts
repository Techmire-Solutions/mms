import { z } from "zod";

/**
 * Canonical calendar-date validation for the `YYYY-MM-DD` strings this codebase
 * stores in `varchar` columns (attendance.date, sessions.start_date,
 * accounting date/period fields).
 *
 * Why a shared schema rather than another inline regex
 * ---------------------------------------------------
 * A bare `/^\d{4}-\d{2}-\d{2}$/` validates SHAPE only, and was independently
 * re-written in several places. It happily accepts dates that do not exist:
 *
 *   '2026-13-01'  month 13
 *   '2026-02-31'  February 31st
 *   '2026-00-10'  month 0
 *   '0000-00-00'
 *
 * For accounting that is not cosmetic — a journal-entry or fiscal-period date is
 * an input to date arithmetic, period comparisons, and aging reports. It also
 * means each module drifted independently: accounting validated ISO shape while
 * the session schemas validated only "non-empty string".
 */

/** Shape check: exactly `YYYY-MM-DD`, four-digit year, zero-padded. */
const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when the string is a real calendar date.
 *
 * Verified by round-tripping through `Date.UTC`: JavaScript normalises
 * out-of-range components (2026-02-31 → 2026-03-03), so a mismatch after the
 * round trip proves the input was not a real date. `Date.UTC` is used rather
 * than the local-time constructor so the result cannot depend on the host
 * timezone — the failure mode this whole module exists to avoid.
 *
 * Note: `Date.UTC` maps years 0–99 to 1900+year, so early years fail the round
 * trip. That is intentional — those are not plausible dates for this domain.
 */
function isRealCalendarDate(value: string): boolean {
  const [yearPart, monthPart, dayPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  return (
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day
  );
}

/** Exported for callers that need the predicate without a Zod schema. */
export function isValidIsoDate(value: string): boolean {
  return ISO_DATE_SHAPE.test(value) && isRealCalendarDate(value);
}

const MESSAGE = "Date must be a real calendar date in YYYY-MM-DD format";

/**
 * A required calendar date.
 *
 * ```ts
 * date: isoDateSchema                       // '2026-01-15'
 * ```
 */
export const isoDateSchema = z
  .string()
  .regex(ISO_DATE_SHAPE, "Date must be in YYYY-MM-DD format")
  .refine(isRealCalendarDate, MESSAGE);

/**
 * A calendar date that may be absent.
 *
 * Several schemas model "no date" as `''` rather than `null`, so this accepts
 * the empty string in addition to a real date — and rejects the in-between cases
 * (`'  '`, partial dates) that a plain `z.string().optional()` would let through.
 *
 * ```ts
 * startDate: isoDateOrEmptySchema          // '' | '2026-01-15'
 * ```
 */
export const isoDateOrEmptySchema = z
  .string()
  .refine((value) => value === "" || isValidIsoDate(value), MESSAGE);

/**
 * Compares two `YYYY-MM-DD` strings chronologically.
 *
 * Lexicographic comparison is exact for zero-padded ISO dates, but it is wrong
 * for anything else — which is why the format has to be enforced before ordering
 * can be trusted (see the session date gap documented in
 * `docs/date-format-audit.md`).
 */
export function compareIsoDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
