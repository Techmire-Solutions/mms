import { useState } from "react";
import {
  defaultJournalReversalDate,
  findFiscalYearForDate,
  isFiscalYearClosed,
  isPriorPeriodJournalReversal,
  todayISO,
  validateJournalReversalDate,
  type FiscalYear,
  type JournalReversalDateIssue,
  type JournalReversalRequest,
  type PostingPeriod,
} from "@mms/contracts";
import type { JournalEntry } from "../index";
import { closedPostingPeriodFor } from "../index";

export type OriginalPeriodStatus = "open" | "closed" | "unconfigured";

/**
 * Reverse-dialog state: the period rules come from `@mms/contracts`, the same
 * helpers the server re-checks at execution time, so the dialog can only
 * pre-empt a refusal, never permit what the API would reject.
 */
export function useJournalReverseDialogState(
  entry: JournalEntry,
  fiscalYears: readonly FiscalYear[],
  postingPeriods: readonly PostingPeriod[] = [],
) {
  const today = todayISO();
  const [date, setDate] = useState(() =>
    defaultJournalReversalDate(entry.date, today, fiscalYears),
  );
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const originalYear = findFiscalYearForDate(fiscalYears, entry.date);
  const originalPeriod: OriginalPeriodStatus = originalYear
    ? isFiscalYearClosed(originalYear)
      ? "closed"
      : "open"
    : fiscalYears.length > 0
      ? "closed"
      : "unconfigured";
  const originalDateAllowed =
    validateJournalReversalDate(entry.date, entry.date, fiscalYears) === null;
  const todayAllowed = validateJournalReversalDate(entry.date, today, fiscalYears) === null;
  const dateIssue: JournalReversalDateIssue | null = date
    ? validateJournalReversalDate(entry.date, date, fiscalYears)
    : "invalid_date";
  const reasonMissing = reason.trim() === "";
  const priorPeriod = !dateIssue && isPriorPeriodJournalReversal(entry.date, date, fiscalYears);
  /**
   * A closed monthly period blocks the reversal exactly like a closed fiscal year:
   * the server answers 422 for that date, so the dialog must flag it on the field
   * instead of sending a request it knows will be refused.
   */
  const closedPeriod = closedPostingPeriodFor(date, postingPeriods);

  /** The validated request, or null after flagging the errors for display. */
  const buildRequest = (): JournalReversalRequest | null => {
    setSubmitted(true);
    if (dateIssue || reasonMissing || closedPeriod) return null;
    const trimmedRemarks = remarks.trim();
    return { date, reason: reason.trim(), ...(trimmedRemarks ? { remarks: trimmedRemarks } : {}) };
  };

  return {
    today,
    date,
    setDate,
    reason,
    setReason,
    remarks,
    setRemarks,
    originalPeriod,
    originalDateAllowed,
    todayAllowed,
    dateIssue: submitted || date ? dateIssue : null,
    /** Label of the closed monthly period that blocks `date`, for the date field error. */
    closedPeriodName: closedPeriod?.label ?? null,
    reasonError: submitted && reasonMissing,
    priorPeriod,
    buildRequest,
  };
}
