import {
  translateApiMessage,
  translateValidationMessage,
} from "@/lib/forms/translateValidationMessage";
import { useCallback, useMemo, useState } from "react";
import type { Account, JournalEntry, FiscalYear } from "@/lib/data/accountingData";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  isValidExchangeRate,
  journalEntryWriteSchema,
  resolveDefaultFiscalYear,
  todayISO,
} from "@mms/shared";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
import { mapApiFormError } from "@/lib/forms/serverFormErrors";
import { notify } from "@/lib/notify";
import type { DraftForm, DraftLine } from "../lib/journalEntryFormTypes";
import type { JournalEntrySave } from "../lib/journalEntriesTypes";
import {
  calculateJournalEntryCompleteness,
  computeJournalEntryTotals,
  isJournalRefUnique,
  validateJournalEntryForm,
  validateJournalPostingGuards,
} from "../lib/journalEntryFormValidation";
import {
  buildJournalEntryDraft,
  emptyJournalLine,
  serializeJournalDraft,
} from "../lib/journalEntryDraft";
import { buildJournalEntrySaveCandidate } from "../lib/journalEntrySaveCandidate";
import { accountOptions } from "../lib/accountOptions";
import { useJournalEntryCurrency } from "./useJournalEntryCurrency";
import { usePostingPeriods } from "./useAccountingLedgerOps";
import { useVoucherNumbering } from "./useVoucherNumbering";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import { useDirtySnapshot } from "@/lib/forms/useDirtySnapshot";

interface UseJournalEntryFormOptions {
  accounts: Account[];
  entries: JournalEntry[];
  onSave: JournalEntrySave;
  initial?: JournalEntry | null;
  fiscalYears: FiscalYear[];
  decimalSeparator?: "period" | "comma";
  requireNarration?: boolean;
}
export function useJournalEntryForm({
  accounts,
  entries,
  onSave,
  initial,
  fiscalYears,
  decimalSeparator = "period",
  requireNarration = true,
}: UseJournalEntryFormOptions) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isEdit = !!initial?.id;
  const activeFiscalYearRecord = resolveDefaultFiscalYear(fiscalYears, todayISO());
  const activeFiscalYear = activeFiscalYearRecord?.id || "";
  const [entryDate, setEntryDate] = useState(initial?.date ?? todayISO());
  const fx = useJournalEntryCurrency(initial, entryDate);
  const functionalCurrency = fx.functionalCurrency;
  const createDraftForm = useCallback(
    (): DraftForm =>
      buildJournalEntryDraft({
        initial,
        functionalCurrency,
        activeFiscalYear,
        activeFiscalYearRecord,
        userName: user?.name,
      }),
    [initial, functionalCurrency, activeFiscalYear, activeFiscalYearRecord, user?.name],
  );
  const [form, setForm] = useState<DraftForm>(createDraftForm);
  const postingPeriodsQuery = usePostingPeriods(form.fiscal_year_id || undefined);
  const voucherNumberingQuery = useVoucherNumbering(form.date);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const initialKey = initial ? JSON.stringify(initial) : "";
  const [formResetKey, setFormResetKey] = useState(initialKey);
  if (formResetKey !== initialKey) {
    setFormResetKey(initialKey);
    setForm(createDraftForm());
    setErrors({});
  }
  // Dirty tracking for the shell's discard confirm. Ignores auto-minted IDs so freshly
  // opened blank forms evaluate clean; `initialKey` (record identity) resets on record changes.
  const draftSignature = serializeJournalDraft(form);
  const baselineSignature = useMemo(
    () => serializeJournalDraft(createDraftForm()),
    [createDraftForm],
  );
  const { isDirty: snapshotDirty } = useDirtySnapshot(
    draftSignature,
    initialKey,
    baselineSignature,
  );
  const isDirty = formResetKey === initialKey && snapshotDirty;
  const [prevFiscalYearId, setPrevFiscalYearId] = useState(activeFiscalYear);
  if (prevFiscalYearId !== activeFiscalYear) {
    setPrevFiscalYearId(activeFiscalYear);
    if (activeFiscalYear) {
      setForm((prev) =>
        prev.fiscal_year_id
          ? prev
          : {
              ...prev,
              fiscal_year_id: activeFiscalYear,
              fiscal_year: activeFiscalYearRecord?.label || prev.fiscal_year,
            },
      );
    }
  }
  const [prevUserName, setPrevUserName] = useState(user?.name);
  if (prevUserName !== user?.name) {
    setPrevUserName(user?.name);
    if (user?.name)
      setForm((prev) => (prev.created_by ? prev : { ...prev, created_by: user.name }));
  }
  const [prevFormDate, setPrevFormDate] = useState(entryDate);
  if (prevFormDate !== form.date) {
    setPrevFormDate(form.date);
    setEntryDate(form.date);
  }
  const { totalDebitCents, totalCreditCents, totalDebit, totalCredit, isBalanced } =
    computeJournalEntryTotals(form.lines, decimalSeparator);
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
    const newLine = emptyJournalLine();
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
      const validationErrors = validateJournalEntryForm(
        form,
        entries,
        targetStatus,
        isBalanced,
        t,
        decimalSeparator,
        requireNarration,
      );
      const guardErrors = validateJournalPostingGuards(
        form,
        {
          fiscalYears,
          postingPeriods: postingPeriodsQuery.data ?? [],
          voucherAutoGenerate: voucherNumberingQuery.data?.autoGenerate,
        },
        t,
      );
      if (Object.keys(validationErrors).length || Object.keys(guardErrors).length) {
        setErrors({ ...validationErrors, ...guardErrors });
        return;
      }
      // A stale draft may still reference an account that is now inactive or a
      // summary/header account; the picker filters those, but edits do not.
      const invalidAccountIndex = form.lines.findIndex(
        (journalLine) =>
          journalLine.account_id && !activeAccountIds.has(String(journalLine.account_id)),
      );
      if (invalidAccountIndex >= 0) {
        setErrors({
          [`line${invalidAccountIndex}`]: t("accounting.journal.form.errorAccountInactive"),
        });
        return;
      }
      if (fx.isForeign && !isValidExchangeRate(fx.rate)) {
        setErrors({ exchangeRate: t("fx.field.rateMissing") });
        return;
      }
      const trimmedRef = form.ref?.trim();
      const journalReference = trimmedRef || (isEdit ? form.ref : "");
      if (!isJournalRefUnique(journalReference, entries, form.id)) {
        setErrors({ ref: t("accounting.journal.form.errorRefDuplicate") });
        return;
      }
      const candidate = buildJournalEntrySaveCandidate({
        form,
        targetStatus,
        userName: user?.name,
        decimalSeparator,
        fx,
        isEdit,
      });
      const parsed = journalEntryWriteSchema.safeParse(candidate);
      if (!parsed.success) {
        setErrors({
          ...mapZodFormErrors(parsed.error, (message) => translateValidationMessage(message, t)),
          schema: t("common.formPleaseFixErrors"),
        });
        return;
      }
      setSubmitting(true);
      try {
        const saved = await onSave(parsed.data);
        if (!isEdit && saved?.ref)
          notify.success(t("accounting.journal.form.voucherAssigned", { number: saved.ref }));
      } catch (error) {
        // The mutation layer already toasts the reason; surface the field(s) it
        // identified and keep a banner fallback so nothing is silent.
        const mapped = mapApiFormError(error, (message) => translateApiMessage(message, t));
        setErrors({
          ...(mapped.fieldErrors ?? {}),
          submit: mapped.message ?? t("accounting.settings.saveEntriesFailed"),
        });
      } finally {
        setSubmitting(false);
      }
    });
  // Stable references: the memoized voucher rows compare `accountOptions` by
  // identity, so rebuilding it every render would defeat the optimization.
  //
  // `accountOptions` is the shared picker helper: it drops header/summary accounts
  // (the server refuses a line on an account that has children), so the picker can
  // no longer offer an account whose save would fail with the summary-account guard.
  const flattenedAccountOptions = useMemo(
    () => accountOptions(accounts).map(({ value, label }) => ({ value, label })),
    [accounts],
  );
  const activeAccountIds = useMemo(
    () => new Set(accountOptions(accounts).map((option) => String(option.value))),
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
    isDirty,
    postingPeriods: postingPeriodsQuery.data ?? [],
    voucherAutoGenerate: voucherNumberingQuery.data?.autoGenerate,
    postingPeriodsLoading: postingPeriodsQuery.isPending,
    postingPeriodsError: postingPeriodsQuery.isError,
    voucherNumberingLoading: voucherNumberingQuery.isPending,
    voucherNumberingError: voucherNumberingQuery.isError,
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
