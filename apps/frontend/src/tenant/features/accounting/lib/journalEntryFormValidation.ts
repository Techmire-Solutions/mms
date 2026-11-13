import { isJournalRefUnique, type JournalEntry } from "@/lib/data/accountingData";
import { tryParseMoneyAmountNumber } from "@mms/shared";
export { isJournalRefUnique };
import { hasFieldValue } from "@/lib/formCompleteness";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { DraftForm } from "./journalEntryFormTypes";

export function parseJournalLineAmount(val: string | number | null | undefined): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (typeof val !== "string") return 0;
  // Strict 2-dp parse: `Number()` accepted exponent notation and silently rounded
  // 3+ decimals before the schema rejected the entry with a generic message.
  return tryParseMoneyAmountNumber(val.replace(/,/g, "").trim()) ?? 0;
}

/** Field-level amount validation for the inline error under each voucher row. */
export function journalLineAmountErrorKey(val: string | number): string | null {
  if (typeof val === "number")
    return Number.isFinite(val) ? null : "accounting.journal.form.errorAmountFormat";
  const cleaned = val.replace(/,/g, "").trim();
  if (!cleaned) return null;
  return tryParseMoneyAmountNumber(cleaned) === null
    ? "accounting.journal.form.errorAmountFormat"
    : null;
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
      return;
    }
    const amountError =
      journalLineAmountErrorKey(journalLine.debit) ?? journalLineAmountErrorKey(journalLine.credit);
    if (amountError) {
      validationErrors[`lineAmount${lineIndex}`] = t(amountError as never);
    }
  });

  return validationErrors;
}
