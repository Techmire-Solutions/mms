import { generateClientEntityId, type JournalEntry, type JournalEntryStatus } from "@mms/shared";
import { applyEntryCurrency } from "./journalEntryCurrency";
import { parseJournalLineAmount } from "./journalEntryFormValidation";
import type { DraftForm } from "./journalEntryFormTypes";
import type { MoneySeparator } from "../hooks/accountingMoneyParsers";

export interface JournalSaveCandidateInput {
  form: DraftForm;
  targetStatus: JournalEntryStatus;
  userName?: string;
  decimalSeparator: MoneySeparator;
  fx: {
    currency: string;
    functionalCurrency: string;
    rate: string;
    isForeign: boolean;
  };
  isEdit: boolean;
}

/** Build the write DTO candidate from the draft; schema parsing happens in the caller. */
export function buildJournalEntrySaveCandidate({
  form,
  targetStatus,
  userName,
  decimalSeparator,
  fx,
  isEdit,
}: JournalSaveCandidateInput): JournalEntry {
  const trimmedRef = form.ref?.trim();
  const journalReference = trimmedRef || (isEdit ? form.ref : "");
  return {
    ...form,
    id: form.id || generateClientEntityId("je"),
    ref: journalReference,
    status: targetStatus,
    created_by: form.created_by || userName || "system",
    lines: applyEntryCurrency(
      form.lines.map((journalLine) => ({
        ...journalLine,
        debit: parseJournalLineAmount(journalLine.debit, decimalSeparator),
        credit: parseJournalLineAmount(journalLine.credit, decimalSeparator),
      })),
      fx.currency || fx.functionalCurrency,
      fx.functionalCurrency || fx.currency,
      fx.rate,
    ),
  };
}
