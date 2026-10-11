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
} from "@mms/shared";
import type { JournalEntry } from "@/lib/data/accountingData";

export type OriginalPeriodStatus = "open" | "closed" | "unconfigured";

/**
 * Reverse-dialog state: the period rules come from `@mms/shared`, the same
 * helpers the server re-checks at execution time, so the dialog can only
 * pre-empt a refusal, never permit what the API would reject.
 */
export function useJournalReverseDialogState(
  entry: JournalEntry,
  fiscalYears: readonly FiscalYear[],
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

  /** The validated request, or null after flagging the errors for display. */
  const buildRequest = (): JournalReversalRequest | null => {
    setSubmitted(true);
    if (dateIssue || reasonMissing) return null;
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
    reasonError: submitted && reasonMissing,
    priorPeriod,
    buildRequest,
  };
}
