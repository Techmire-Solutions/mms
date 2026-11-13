import { isJournalRefUnique, type JournalEntry } from "@/lib/data/accountingData";
import type { JournalEntryStatus } from "@mms/shared";
import {
  hasAtMostTwoDecimals,
  parseMoneyInput,
  type MoneySeparator,
} from "../hooks/accountingMoneyParsers";
export { isJournalRefUnique };
import { hasFieldValue } from "@/lib/formCompleteness";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { DraftForm } from "./journalEntryFormTypes";

/**
 * Strict, separator-aware parse of one voucher amount.
 *
 * Deleting commas (the old behaviour) turned a comma-decimal `"1234,56"` into
 * `123456` — a 100× posting to an append-only ledger that no row error caught.
 * `parseMoneyInput` accepts grouping only in valid thousands groups for the
 * workspace separator, so the natural comma form reads correctly and anything
 * ambiguous is refused instead of rescaled.
 */
export function parseJournalLineAmount(
  val: string | number | null | undefined,
  decimalSeparator: MoneySeparator = "period",
): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (typeof val !== "string" || !val.trim()) return 0;
  const parsed = parseMoneyInput(val, decimalSeparator);
  if (parsed === null || !hasAtMostTwoDecimals(parsed)) return 0;
  return parsed;
}

/** Field-level amount validation for the inline error under each voucher row. */
export function journalLineAmountErrorKey(
  val: string | number,
  decimalSeparator: MoneySeparator = "period",
): string | null {
  if (typeof val === "number")
    return Number.isFinite(val) ? null : "accounting.journal.form.errorAmountFormat";
  if (!val.trim()) return null;
  const parsed = parseMoneyInput(val, decimalSeparator);
  return parsed === null || !hasAtMostTwoDecimals(parsed)
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
  targetStatus: JournalEntryStatus,
  isBalanced: boolean,
  t: TranslationFunction,
  decimalSeparator: MoneySeparator = "period",
  requireNarration = true,
): Record<string, string> {
  const validationErrors: Record<string, string> = {};
  if (!form.date) validationErrors.date = t("accounting.journal.form.errorDate");
  // Setup → Rules can switch narration off; the backend has no such requirement,
  // so the flag is the only gate and the form must honour it.
  if (requireNarration && !form.description.trim())
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
      journalLineAmountErrorKey(journalLine.debit, decimalSeparator) ??
      journalLineAmountErrorKey(journalLine.credit, decimalSeparator);
    if (amountError) {
      validationErrors[`lineAmount${lineIndex}`] = t(amountError as never);
    }
  });

  return validationErrors;
}
