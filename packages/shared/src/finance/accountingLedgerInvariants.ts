import { z } from "zod";

/**
 * How a journal entry was created — used for idempotent finance posting.
 */
export const JOURNAL_SOURCE_TYPES = [
  "manual",
  "invoice",
  "payment",
  "closing",
  "reversal",
  "opening",
  "obligation",
  /** IAS 21 period-end revaluation and its automatic next-day reversal. */
  "fx_reval",
  "fx_reval_reversal",
  "ias29_restate",
  "ias29_reversal",
  "hedge_val",
  "hedge_val_rev",
  "hedge_settle",
  "hedge_reclass",
] as const;

export type JournalSourceType = (typeof JOURNAL_SOURCE_TYPES)[number];

export function isJournalSourceType(value: string): value is JournalSourceType {
  return (JOURNAL_SOURCE_TYPES as readonly string[]).includes(value);
}

export interface JournalLineAmounts {
  debit: number;
  credit: number;
}

export interface FiscalYearRef {
  id: string;
  label: string;
  status: string;
}

/** Convert a money number to integer cents for exact debit/credit compares. */
export function moneyToCents(amount: number): number {
  return Math.round(amount * 100);
}

const hasAtMostTwoDecimals = (value: number): boolean =>
  Math.abs(value - Math.round(value * 100) / 100) < 1e-9;

/**
 * Every money field that travels as a number must round-trip through integer cents
 * exactly. Beyond 2^53 cents, `Number` storage silently drops a cent — such a
 * column must move to a decimal-string DTO instead of widening this bound.
 */
const hasSafeCents = (value: number): boolean => Number.isSafeInteger(Math.round(value * 100));

const moneyCentsChecks = [
  (value: number) => Number.isFinite(value),
  (value: number) => hasAtMostTwoDecimals(value),
  (value: number) => hasSafeCents(value),
] as const;

/**
 * Non-negative money with at most two decimal places and safe integer cents, so
 * ledger arithmetic can round-trip without silent precision loss.
 */
export const moneyAmountSchema = z
  .number()
  .finite()
  .nonnegative()
  .refine(moneyCentsChecks[1], { message: "accounting.validation.moneyTwoDecimals" })
  .refine(moneyCentsChecks[2], { message: "accounting.validation.moneySafeCents" });

/** Positive money (payments, allocations): 2-dp and safely convertible to cents. */
export const positiveMoneyAmountSchema = moneyAmountSchema.refine((value) => value > 0, {
  message: "accounting.validation.moneyPositive",
});

/** Signed money with at most two decimal places (bank statement lines, balances). */
export const signedMoneyAmountSchema = z
  .number()
  .refine(moneyCentsChecks[0], { message: "accounting.validation.moneyFinite" })
  .refine(moneyCentsChecks[1], { message: "accounting.validation.moneyTwoDecimals" })
  .refine(moneyCentsChecks[2], { message: "accounting.validation.moneySafeCents" });

const DECIMAL_AMOUNT_RE = /^(-?)(\d{1,15})(?:\.(\d{1,10}))?$/;

/**
 * Exact decimal string → integer cents, half-up when `round` is set.
 *
 * Never passes through a float: `Number('1234567890123.45')` is exact only until
 * the cent count leaves 2^53, and an FX conversion can carry ten decimals.
 */
function decimalAmountToCents(value: string, round: boolean): number {
  const match = DECIMAL_AMOUNT_RE.exec(value.trim());
  if (!match) throw new Error(`Invalid decimal amount "${value}"`);
  const sign = match[1] === "-" ? -1 : 1;
  const wholeCents = Number.parseInt(match[2]!, 10) * 100;
  const fraction = (match[3] ?? "").padEnd(10, "0");
  const cents = Number.parseInt(fraction.slice(0, 2), 10);
  const subCent = Number.parseInt(fraction.slice(2), 10);
  if (!round && subCent !== 0) {
    throw new Error(`Amount "${value}" has more than two decimal places`);
  }
  // `subCent` is the remaining 8 digits of the 10-digit fraction: half a cent is
  // 50,000,000 of those units.
  const rounded = cents + (round && subCent >= 50_000_000 ? 1 : 0);
  const total = wholeCents + rounded;
  if (!Number.isSafeInteger(total)) {
    throw new Error(`Amount "${value}" exceeds exact integer cents`);
  }
  return sign * total;
}

/**
 * Parses a validated money input (form draft, specialized-entry amount) to the
 * 2-dp number the DTOs carry. Throws on more than two decimals or unsafe cents —
 * use {@link tryParseMoneyAmountNumber} where invalid input is expected.
 */
export function parseMoneyAmountNumber(value: string | number): number {
  if (typeof value === "number") {
    moneyAmountSchema.parse(value);
    return value;
  }
  const cents = decimalAmountToCents(value, false);
  if (cents < 0) throw new Error(`Amount "${value}" must not be negative`);
  return cents / 100;
}

/** Null-returning variant for UI comparisons (`Number(input) > 0`). */
export function tryParseMoneyAmountNumber(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    return parseMoneyAmountNumber(value);
  } catch {
    return null;
  }
}

/**
 * Rounds any decimal string (e.g. an FX-converted amount with ten decimals) to the
 * ledger's 2-dp number, half-up and exact. Replaces `Number(moneyToDecimalString())`.
 */
export function roundMoneyAmount(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid money amount");
    return decimalAmountToCents(value.toFixed(10), true) / 100;
  }
  return decimalAmountToCents(value, true) / 100;
}

/**
 * A journal line is single-sided when at most one of debit/credit is positive
 * and neither is negative.
 */
export function isJournalLineSingleSided(line: JournalLineAmounts): boolean {
  const debitCents = moneyToCents(line.debit);
  const creditCents = moneyToCents(line.credit);
  return debitCents >= 0 && creditCents >= 0 && (debitCents === 0 || creditCents === 0);
}

/**
 * Posted (and any explicitly checked) entries must have at least two lines,
 * each single-sided, and matching debit/credit totals.
 */
export function isJournalEntryBalanced(lines: readonly JournalLineAmounts[]): boolean {
  if (lines.length < 2) return false;
  let debitCents = 0;
  let creditCents = 0;
  for (const line of lines) {
    if (!isJournalLineSingleSided(line)) return false;
    debitCents += moneyToCents(line.debit);
    creditCents += moneyToCents(line.credit);
  }
  return debitCents === creditCents && debitCents > 0;
}

/**
 * Resolve a fiscal year by id or display label (legacy `fiscal_year` varchar).
 */
export function resolveFiscalYearRef(
  years: readonly FiscalYearRef[],
  ref: string | undefined | null,
): FiscalYearRef | null {
  const needle = ref?.trim() ?? "";
  if (!needle) return null;
  return years.find((year) => year.id === needle || year.label === needle) ?? null;
}

export function isFiscalYearClosed(year: FiscalYearRef | null | undefined): boolean {
  return year?.status === "closed";
}

/** A fiscal year that also carries the date range used for date-based resolution. */
export interface FiscalYearRange extends FiscalYearRef {
  startDate: string;
  endDate: string;
}

/**
 * The fiscal year whose `[startDate, endDate]` range contains `date`.
 *
 * Closed-period enforcement must key off the entry DATE, not only off the
 * declared `fiscal_year` / `fiscal_year_id` label: reports filter by date, so an
 * entry dated inside a closed period contaminates that period's figures no
 * matter which year it claims to belong to.
 *
 * Returns null for a missing/malformed date or a date that falls outside every
 * configured year (a workspace with no fiscal years configured must stay
 * postable, so callers treat null as "unregulated" rather than "reject").
 */
export function findFiscalYearForDate<T extends FiscalYearRange>(
  years: readonly T[],
  date: string | undefined | null,
): T | null {
  const needle = date?.trim() ?? "";
  if (!needle) return null;
  return years.find((year) => year.startDate <= needle && needle <= year.endDate) ?? null;
}

/**
 * The fiscal year new work should default to (journal forms, quick transactions,
 * report ranges): the open year whose range contains `today`. Several years can
 * be open at once (next year set up early, last year awaiting close), and the
 * `active` flag is set by hand, so the calendar decides first. Falls back to the
 * open year flagged `active` when no open year covers today, else null.
 */
export function resolveDefaultFiscalYear<T extends FiscalYearRange>(
  years: readonly T[] | null | undefined,
  today: string,
): T | null {
  const openYears = (years ?? []).filter((year) => !isFiscalYearClosed(year));
  return (
    findFiscalYearForDate(openYears, today) ??
    openYears.find((year) => year.status === "active") ??
    null
  );
}
