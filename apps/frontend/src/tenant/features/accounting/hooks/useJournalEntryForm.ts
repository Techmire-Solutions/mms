import { useState, useEffect } from "react";
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
  const [form, setForm] = useState<DraftForm>(() => {
    return initial
      ? {
          ...initial,
          lines: draftLinesFromEntry(initial.lines, functionalCurrency),
        }
      : {
          id: "",
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
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const base: DraftForm = initial
      ? {
          ...initial,
          lines: draftLinesFromEntry(initial.lines, functionalCurrency),
        }
      : {
          id: "",
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
    setForm(base);
    setErrors({});
    // functionalCurrency is deliberately not a dependency: a late settings load must not
    // reset a draft the user is typing; draftLinesFromEntry renders stored lines either way.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, activeFiscalYear, activeFiscalYearRecord?.label, user?.name]);

  useEffect(() => setEntryDate(form.date), [form.date]);

  // Money is summed through integer cents (and converted once) so the totals
  // shown beside the lines are the same figures the ledger posts, with no float
  // artefacts such as 0.30000000000000004.
  const totalDebit =
    moneyToCents(
      form.lines.reduce((sum, journalLine) => sum + parseJournalLineAmount(journalLine.debit), 0),
    ) / 100;
  const totalCredit =
    moneyToCents(
      form.lines.reduce((sum, journalLine) => sum + parseJournalLineAmount(journalLine.credit), 0),
    ) / 100;
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

  const updateLine = (lineIndex: number, field: keyof DraftLine, fieldValue: string | number) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      lines[lineIndex] = { ...lines[lineIndex], [field]: fieldValue };
      if (field === "debit" && fieldValue) lines[lineIndex].credit = "";
      if (field === "credit" && fieldValue) lines[lineIndex].debit = "";
      return { ...prev, lines };
    });
  };

  const addLine = () => {
    const unbalance = Math.round((totalDebit - totalCredit) * 100) / 100;
    const newLine = EMPTY_LINE();
    if (unbalance > 0) {
      newLine.credit = unbalance.toFixed(2);
    } else if (unbalance < 0) {
      newLine.debit = Math.abs(unbalance).toFixed(2);
    }
    setForm((prev) => ({ ...prev, lines: [...prev.lines, newLine] }));
  };
  const removeLine = (lineIndex: number) => {
    if (form.lines.length <= 2) return;
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, currentIndex) => currentIndex !== lineIndex),
    }));
  };

  const toggleTag = (tag: string) => {
    setForm((prev) => {
      const tags = prev.tags?.includes(tag)
        ? prev.tags.filter((existingTag) => existingTag !== tag)
        : [...(prev.tags || []), tag];
      return { ...prev, tags };
    });
  };

  const saveEntry = async (saveAs?: "draft" | "posted") => {
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
      id: isEdit ? form.id : generateClientEntityId("je"),
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
    } finally {
      setSubmitting(false);
    }
  };

  const sortedAccounts = accounts
    .filter((account) => account.isActive !== false)
    .toSorted((firstAccount, secondAccount) => firstAccount.code.localeCompare(secondAccount.code));

  const flattenedAccountOptions = sortedAccounts.map((account) => ({
    value: account.id,
    label: `${account.type}: ${account.code} – ${account.name}`,
  }));

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
