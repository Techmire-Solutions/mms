import { isJournalRefUnique, type JournalEntry } from "@/lib/data/accountingData";
export { isJournalRefUnique };
import { hasFieldValue } from "@/lib/formCompleteness";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { DraftForm } from "./journalEntryFormTypes";

export function parseJournalLineAmount(val: string | number | null | undefined): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (typeof val !== "string") return 0;
  const cleaned = val.replace(/,/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export function calculateJournalEntryCompleteness(form: DraftForm, isBalanced: boolean): number {
  const total = 4;
  let filled = 0;
  if (hasFieldValue(form.date)) filled += 1;
  if (hasFieldValue(form.description)) filled += 1;
  if (form.lines.filter((line) => line.account_id).length >= 2) filled += 1;
  if (isBalanced) filled += 1;
  return Math.round((filled / total) * 100);
}

export function validateJournalEntryForm(
  form: DraftForm,
  entries: JournalEntry[],
  targetStatus: "draft" | "posted",
  isBalanced: boolean,
  t: TranslationFunction,
): Record<string, string> {
  const validationErrors: Record<string, string> = {};
  if (!form.date) validationErrors.date = t("accounting.journal.form.errorDate");
  if (!form.description.trim())
    validationErrors.description = t("accounting.journal.form.errorNarration");
  const trimmedRef = form.ref?.trim();
  if (trimmedRef && !isJournalRefUnique(trimmedRef, entries, form.id)) {
    validationErrors.ref = t("accounting.journal.form.errorRefDuplicate");
  }
  const filledLines = form.lines.filter((journalLine) => journalLine.account_id);
  if (filledLines.length < 2) validationErrors.lines = t("accounting.journal.form.errorLines");

  if (targetStatus === "posted" && !isBalanced) {
    validationErrors.balance = t("accounting.journal.form.errorBalance");
  }
  form.lines.forEach((journalLine, lineIndex) => {
    if (!journalLine.account_id) {
      validationErrors[`line${lineIndex}`] = t("accounting.journal.form.errorAccountRequired");
    }
  });

  return validationErrors;
}
