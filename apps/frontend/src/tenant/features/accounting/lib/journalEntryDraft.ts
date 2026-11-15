import { generateClientEntityId, todayISO } from "@mms/shared";
import type { FiscalYear, JournalEntry } from "@/lib/data/accountingData";
import { draftLinesFromEntry } from "./journalEntryCurrency";
import type { DraftForm, DraftLine } from "./journalEntryFormTypes";

/** A fresh blank journal line (new id per row). */
export function emptyJournalLine(): DraftLine {
  return {
    id: generateClientEntityId("l", "-"),
    account_id: "",
    debit: "",
    credit: "",
    description: "",
  };
}

export interface JournalEntryDraftInput {
  initial?: JournalEntry | null;
  functionalCurrency: string;
  activeFiscalYear: string;
  activeFiscalYearRecord?: FiscalYear | null;
  userName?: string;
}

/**
 * Blank or edit baseline for the journal form.
 *
 * `functionalCurrency` is deliberately not a reset trigger: a late settings load
 * must not reset a draft the user is typing — `draftLinesFromEntry` renders stored
 * lines either way. The id is minted once per form session so a validation retry
 * or a second save updates the same voucher.
 */
export function buildJournalEntryDraft({
  initial,
  functionalCurrency,
  activeFiscalYear,
  activeFiscalYearRecord,
  userName,
}: JournalEntryDraftInput): DraftForm {
  if (initial) {
    return {
      ...initial,
      lines: draftLinesFromEntry(initial.lines, functionalCurrency),
    };
  }
  return {
    id: generateClientEntityId("je"),
    ref: "",
    date: todayISO(),
    description: "",
    status: "draft",
    tags: [],
    attachments: [],
    fiscal_year: activeFiscalYearRecord?.label || "",
    fiscal_year_id: activeFiscalYear,
    lines: [emptyJournalLine(), emptyJournalLine()],
    created_by: userName ?? "",
  };
}
