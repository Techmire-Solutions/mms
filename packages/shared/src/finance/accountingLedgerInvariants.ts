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
  /** IAS 21 period-end revaluation and its automatic next-day reversal. */
  "fx_reval",
  "fx_reval_reversal",
  "ias29_restate",
  "ias29_reversal",
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
 * Non-negative money with at most two decimal places, so ledger arithmetic can
 * round-trip through integer cents without silent precision loss.
 */
export const moneyAmountSchema = z
  .number()
  .finite()
  .nonnegative()
  .refine(hasAtMostTwoDecimals, { message: "accounting.validation.moneyTwoDecimals" });

/** Signed money with at most two decimal places (bank statement lines). */
export const signedMoneyAmountSchema = z
  .number()
  .finite()
  .refine(hasAtMostTwoDecimals, { message: "accounting.validation.moneyTwoDecimals" });

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
