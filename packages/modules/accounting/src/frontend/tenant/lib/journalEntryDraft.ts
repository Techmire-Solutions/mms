import { generateClientEntityId, todayISO } from "@mms/contracts";
import type { FiscalYear, JournalEntry } from "@mms/mod-accounting/frontend/tenant";
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

/**
 * Normalizes a draft form into a stable signature ignoring minted client IDs.
 * Used for dirty-state comparison so newly opened forms don't evaluate as dirty.
 */
export function serializeJournalDraft(form: DraftForm): string {
  return JSON.stringify({
    ref: String(form.ref ?? "").trim(),
    date: String(form.date ?? ""),
    description: String(form.description ?? "").trim(),
    fiscal_year_id: String(form.fiscal_year_id ?? ""),
    tags: form.tags ?? [],
    attachments: form.attachments ?? [],
    lines: (form.lines ?? []).map((l) => ({
      account_id: String(l.account_id ?? ""),
      debit: String(l.debit ?? "").trim(),
      credit: String(l.credit ?? "").trim(),
      description: String(l.description ?? "").trim(),
    })),
  });
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
