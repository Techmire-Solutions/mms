import { useCallback, useMemo, useState } from "react";
import type { Account, JournalEntry, FiscalYear } from "@/lib/data/accountingData";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  generateClientEntityId,
  isJournalEntryBalanced,
  isValidExchangeRate,
  journalEntryRecordSchema,
  moneyToCents,
  resolveDefaultFiscalYear,
  todayISO,
} from "@mms/shared";
import { notify } from "@/lib/notify";
import type { DraftForm, DraftLine } from "../lib/journalEntryFormTypes";
import type { JournalEntrySave } from "../lib/journalEntriesTypes";
import {
  parseJournalLineAmount,
  calculateJournalEntryCompleteness,
  validateJournalEntryForm,
  isJournalRefUnique,
} from "../lib/journalEntryFormValidation";
import { applyEntryCurrency, draftLinesFromEntry } from "../lib/journalEntryCurrency";
import { useJournalEntryCurrency } from "./useJournalEntryCurrency";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";

const EMPTY_LINE = (): DraftLine => ({
  id: generateClientEntityId("l", "-"),
  account_id: "",
  debit: "",
  credit: "",
  description: "",
});

interface UseJournalEntryFormOptions {
  accounts: Account[];
  entries: JournalEntry[];
  onSave: JournalEntrySave;
  initial?: JournalEntry | null;
  fiscalYears: FiscalYear[];
}

export function useJournalEntryForm({
  accounts,
  entries,
  onSave,
  initial,
  fiscalYears,
}: UseJournalEntryFormOptions) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isEdit = !!initial?.id;
  const activeFiscalYearRecord = resolveDefaultFiscalYear(fiscalYears, todayISO());
  const activeFiscalYear = activeFiscalYearRecord?.id || "";

  const [entryDate, setEntryDate] = useState(initial?.date ?? todayISO());
  const fx = useJournalEntryCurrency(initial, entryDate);
  const functionalCurrency = fx.functionalCurrency;

  // The blank/edit baseline the form resets to when its inputs change.
  // functionalCurrency is deliberately not part of that trigger: a late settings
  // load must not reset a draft the user is typing; draftLinesFromEntry renders
  // stored lines either way.
  const createDraftForm = (): DraftForm =>
    initial
      ? {
          ...initial,
          lines: draftLinesFromEntry(initial.lines, functionalCurrency),
        }
      : {
          // One id per form session: a validation retry or a second save must
          // update the same draft, not create another voucher.
          id: generateClientEntityId("je"),
          ref: "",
          date: todayISO(),
          description: "",
          status: "draft",
          tags: [],
          attachments: [],
          fiscal_year: activeFiscalYearRecord?.label || "",
          fiscal_year_id: activeFiscalYear,
          lines: [EMPTY_LINE(), EMPTY_LINE()],
          created_by: user?.name ?? "",
        };

  const [form, setForm] = useState<DraftForm>(createDraftForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Reset the draft when the edited entry, fiscal year or user changes — during
  // render instead of in an effect. The entry is compared by content so an
  // equal-value rerender of the same record cannot loop through the guard.
  const initialKey = initial ? JSON.stringify(initial) : "";
  const [formResetInputs, setFormResetInputs] = useState({
    initialKey,
    activeFiscalYear,
    fiscalYearLabel: activeFiscalYearRecord?.label,
    userName: user?.name,
  });
  if (
    formResetInputs.initialKey !== initialKey ||
    formResetInputs.activeFiscalYear !== activeFiscalYear ||
    formResetInputs.fiscalYearLabel !== activeFiscalYearRecord?.label ||
    formResetInputs.userName !== user?.name
  ) {
    setFormResetInputs({
      initialKey,
      activeFiscalYear,
      fiscalYearLabel: activeFiscalYearRecord?.label,
      userName: user?.name,
    });
    setForm(createDraftForm());
    setErrors({});
  }

  // The date field lives on the draft; keep the currency hook's date in step.
  const [prevFormDate, setPrevFormDate] = useState(entryDate);
  if (prevFormDate !== form.date) {
    setPrevFormDate(form.date);
    setEntryDate(form.date);
  }

  // Money is summed through integer cents (and converted once) so the totals
  // shown beside the lines are the same figures the ledger posts, with no float
  // artefacts such as 0.30000000000000004.
  // Sum integer cents per line: summing parsed floats first let a long voucher
  // drift before the single rounding (0.1 + 0.2 + … ≠ 0.3 in binary floats).
  const totalDebitCents = form.lines.reduce(
    (cents, journalLine) => cents + moneyToCents(parseJournalLineAmount(journalLine.debit)),
    0,
  );
  const totalCreditCents = form.lines.reduce(
    (cents, journalLine) => cents + moneyToCents(parseJournalLineAmount(journalLine.credit)),
    0,
  );
  const totalDebit = totalDebitCents / 100;
  const totalCredit = totalCreditCents / 100;
  /**
   * Balanced by the same rule the server enforces (`isJournalEntryBalanced`:
   * exact integer cents, at least two lines, each single-sided) instead of a
   * second, weaker float comparison with a 0.01 tolerance.
   */
  const isBalanced = isJournalEntryBalanced(
    form.lines.map((journalLine) => ({
      debit: parseJournalLineAmount(journalLine.debit),
      credit: parseJournalLineAmount(journalLine.credit),
    })),
  );

  const completeness = calculateJournalEntryCompleteness(form, isBalanced);

  const updateLine = useCallback(
    (lineIndex: number, field: keyof DraftLine, fieldValue: string | number) => {
      setForm((prev) => {
        const lines = [...prev.lines];
        lines[lineIndex] = { ...lines[lineIndex], [field]: fieldValue };
        if (field === "debit" && fieldValue) lines[lineIndex].credit = "";
        if (field === "credit" && fieldValue) lines[lineIndex].debit = "";
        return { ...prev, lines };
      });
    },
    [],
  );

  const addLine = useCallback(() => {
    const unbalanceCents = totalDebitCents - totalCreditCents;
    const newLine = EMPTY_LINE();
    if (unbalanceCents > 0) {
      newLine.credit = (unbalanceCents / 100).toFixed(2);
    } else if (unbalanceCents < 0) {
      newLine.debit = (Math.abs(unbalanceCents) / 100).toFixed(2);
    }
    setForm((prev) => ({ ...prev, lines: [...prev.lines, newLine] }));
  }, [totalDebitCents, totalCreditCents]);

  const removeLine = useCallback((lineIndex: number) => {
    setForm((prev) => {
      if (prev.lines.length <= 2) return prev;
      return {
        ...prev,
        lines: prev.lines.filter((_, currentIndex) => currentIndex !== lineIndex),
      };
    });
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setForm((prev) => {
      const tags = prev.tags?.includes(tag)
        ? prev.tags.filter((existingTag) => existingTag !== tag)
        : [...(prev.tags || []), tag];
      return { ...prev, tags };
    });
  }, []);

  const guard = useSubmitGuard();

  const saveEntry = async (saveAs?: "draft" | "posted") =>
    guard(async () => {
      const targetStatus = saveAs ?? form.status;
      const validationErrors = validateJournalEntryForm(form, entries, targetStatus, isBalanced, t);
      if (Object.keys(validationErrors).length) {
        setErrors(validationErrors);
        return;
      }
      if (fx.isForeign && !isValidExchangeRate(fx.rate)) {
        setErrors({ exchangeRate: t("fx.field.rateMissing") });
        return;
      }
      const trimmedRef = form.ref?.trim();
      // Blank on create → the server assigns the next voucher number on save.
      const journalReference = trimmedRef || (isEdit ? form.ref : "");
      if (!isJournalRefUnique(journalReference, entries, form.id)) {
        setErrors({ ref: t("accounting.journal.form.errorRefDuplicate") });
        return;
      }
      const candidate = {
        ...form,
        id: form.id || generateClientEntityId("je"),
        ref: journalReference,
        status: targetStatus,
        created_by: form.created_by || user?.name || "system",
        lines: applyEntryCurrency(
          form.lines.map((journalLine) => ({
            ...journalLine,
            debit: parseJournalLineAmount(journalLine.debit),
            credit: parseJournalLineAmount(journalLine.credit),
          })),
          fx.currency || functionalCurrency,
          functionalCurrency || fx.currency,
          fx.rate,
        ),
      };
      const parsed = journalEntryRecordSchema.safeParse(candidate);
      if (!parsed.success) {
        setErrors({ schema: t("common.formPleaseFixErrors") });
        return;
      }
      setSubmitting(true);
      try {
        const saved = await onSave(parsed.data);
        if (!isEdit && saved?.ref)
          notify.success(t("accounting.journal.form.voucherAssigned", { number: saved.ref }));
      } catch (error) {
        // The mutation layer already toasts the reason; surface it in the form too
        // instead of letting the rejection escape as an unhandled promise.
        setErrors({
          submit:
            error instanceof Error ? error.message : t("accounting.settings.saveEntriesFailed"),
        });
      } finally {
        setSubmitting(false);
      }
    });

  // Stable references: the memoized voucher rows compare `accountOptions` by
  // identity, so rebuilding it every render would defeat the optimization.
  const flattenedAccountOptions = useMemo(
    () =>
      accounts
        .filter((account) => account.isActive !== false)
        .toSorted((firstAccount, secondAccount) =>
          firstAccount.code.localeCompare(secondAccount.code),
        )
        .map((account) => ({
          value: account.id,
          label: `${account.type}: ${account.code} – ${account.name}`,
        })),
    [accounts],
  );

  const errorMessages = (() => Object.values(errors).filter(Boolean))();

  return {
    t,
    fx,
    isEdit,
    activeFiscalYear,
    form,
    setForm,
    errors,
    submitting,
    totalDebit,
    totalCredit,
    isBalanced,
    completeness,
    updateLine,
    addLine,
    removeLine,
    toggleTag,
    saveEntry,
    flattenedAccountOptions,
    errorMessages,
  };
}
