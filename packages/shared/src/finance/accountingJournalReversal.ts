import { z } from "zod";
import {
  findFiscalYearForDate,
  isFiscalYearClosed,
  type FiscalYearRange,
} from "./accountingLedgerInvariants.js";
import { isoDateSchema, isValidIsoDate } from "../core/isoDateSchema.js";

/** Body of `POST /api/accounting/entries/:id/reverse`. */
export const journalReversalRequestSchema = z
  .object({
    date: isoDateSchema,
    reason: z.string().trim().min(1, "accounting.journal.reverse.reasonRequired").max(500),
    remarks: z.string().trim().max(1000).optional(),
  })
  .strict();

export type JournalReversalRequest = z.infer<typeof journalReversalRequestSchema>;

/**
 * Source types whose postings are owned by another workflow and may not be
 * reversed by hand: invoices/payments reverse through Finance (cancel, credit
 * note, archive) under their own source keys, so a manual reversal would let
 * Finance reverse the same figure a second time; a year-end closing entry is
 * irreversible by design.
 */
export const NON_REVERSIBLE_JOURNAL_SOURCES = [
  "invoice",
  "payment",
  "closing",
  // Revaluations reverse themselves on the next day; a manual reversal would double it.
  "fx_reval",
  "fx_reval_reversal",
] as const;

/** True when a journal of this source type may be reversed through the Reverse Entry action. */
export function isManuallyReversibleJournalSource(sourceType: string | null | undefined): boolean {
  return !(NON_REVERSIBLE_JOURNAL_SOURCES as readonly string[]).includes(sourceType ?? "");
}

export type JournalReversalDateIssue =
  "invalid_date" | "before_original" | "closed_period" | "outside_fiscal_years";

/**
 * True when `date` may not receive postings: it falls in a closed fiscal year,
 * or fiscal years are configured and none of them contains it. A workspace with
 * no fiscal years at all stays unregulated (existing ledger policy).
 */
export function isPostingDateLocked(years: readonly FiscalYearRange[], date: string): boolean {
  const containing = findFiscalYearForDate(years, date);
  if (containing) return isFiscalYearClosed(containing);
  return years.length > 0;
}

/** Why `date` cannot carry the reversal of an entry dated `originalDate`, or null when it can. */
export function validateJournalReversalDate(
  originalDate: string,
  date: string,
  years: readonly FiscalYearRange[],
): JournalReversalDateIssue | null {
  if (!isValidIsoDate(date)) return "invalid_date";
  if (date < originalDate) return "before_original";
  const containing = findFiscalYearForDate(years, date);
  if (isFiscalYearClosed(containing)) return "closed_period";
  if (!containing && years.length > 0) return "outside_fiscal_years";
  return null;
}

/**
 * Default reversal posting date.
 *
 * Original period open → the original posting date (historical correction in
 * the same period). Original period closed → today when today is postable,
 * otherwise '' so the user must pick an open-period date.
 */
export function defaultJournalReversalDate(
  originalDate: string,
  today: string,
  years: readonly FiscalYearRange[],
): string {
  if (validateJournalReversalDate(originalDate, originalDate, years) === null) return originalDate;
  if (validateJournalReversalDate(originalDate, today, years) === null) return today;
  return "";
}

/**
 * A reversal that lands in a different fiscal year than its original, where the
 * original's year is already closed — a potential prior-period correction that
 * an authorized accountant must review rather than treat as routine.
 */
export function isPriorPeriodJournalReversal(
  originalDate: string,
  reversalDate: string,
  years: readonly FiscalYearRange[],
): boolean {
  const originalYear = findFiscalYearForDate(years, originalDate);
  if (!originalYear || !isFiscalYearClosed(originalYear)) return false;
  return findFiscalYearForDate(years, reversalDate)?.id !== originalYear.id;
}
