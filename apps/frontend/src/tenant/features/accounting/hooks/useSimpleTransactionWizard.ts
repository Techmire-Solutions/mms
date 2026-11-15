import { translateApiMessage } from "@/lib/forms/translateValidationMessage";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { isJournalRefUnique, type JournalEntry } from "@/lib/data/accountingData";
import {
  generateClientEntityId,
  isJournalEntryBalanced,
  journalEntryWriteSchema,
} from "@mms/shared";
import { mapApiFormError } from "@/lib/forms/serverFormErrors";
import { notify } from "@/lib/notify";
import { validateWizardForm } from "../lib/simpleTransactionWizardTypes";
import { validateJournalPostingGuards } from "../lib/journalEntryFormValidation";
import { parseMoneyInput } from "../lib/simpleTransactionMoney";
import { quickActionDescription, quickActionLabel } from "../lib/quickActionLabels";
import type { JournalEntrySave } from "../lib/journalEntriesTypes";
import type { DraftForm } from "../lib/journalEntryFormTypes";
import { usePostingPeriods } from "./useAccountingLedgerOps";
import { useVoucherNumbering } from "./useVoucherNumbering";
import {
  useSimpleTransactionDraft,
  LAST_TYPE_SESSION_KEY,
  type UseSimpleTransactionDraftParams,
} from "./useSimpleTransactionDraft";

export { LAST_TYPE_SESSION_KEY };

export interface UseSimpleTransactionWizardParams extends Omit<
  UseSimpleTransactionDraftParams,
  "t"
> {
  entries: JournalEntry[];
  onSave: JournalEntrySave;
}

export function useSimpleTransactionWizard({
  open,
  accounts,
  entries,
  fiscalYears,
  onSave,
  prefillType,
  prefillAmount,
  prefillDescription,
  transactionGroups,
}: UseSimpleTransactionWizardParams) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [submittingStatus, setSubmittingStatus] = useState<
    "draft" | "posted" | "posted_and_new" | null
  >(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isSubmitting = submittingStatus !== null;
  // One voucher identity per wizard session: a retry after a failure must not
  // create a second entry with a different client id.
  const sessionEntryIdRef = useRef(generateClientEntityId("je"));
  const inFlightRef = useRef(false);

  const {
    step,
    setStep,
    selectedType,
    showAdvanced,
    setShowAdvanced,
    amountTouched,
    setAmountTouched,
    form,
    setForm,
    handleTypeSelect,
  } = useSimpleTransactionDraft({
    open,
    accounts,
    fiscalYears,
    prefillType,
    prefillAmount,
    prefillDescription,
    t,
    transactionGroups,
  });

  const fiscalYearId = (fiscalYears || []).find(
    (year) => year.label === form.fiscal_year || year.id === form.fiscal_year,
  )?.id;
  const postingPeriodsQuery = usePostingPeriods(fiscalYearId);
  const voucherNumberingQuery = useVoucherNumbering(form.date);
  const parsedAmount = useMemo(() => parseMoneyInput(form.amount), [form.amount]);

  const stepSubtitle = useMemo(() => {
    if (step === 2 && selectedType) return quickActionLabel(selectedType, t);
    if (step === 3) return t("accounting.journal.dashboard.wizard.reviewTitle");
    return t("accounting.journal.dashboard.subtitleSimple");
  }, [step, selectedType, t]);

  const isDuplicateRef = useMemo(() => {
    const trimmed = form.ref ? form.ref.trim() : "";
    if (!trimmed || !entries) return false;
    return !isJournalRefUnique(trimmed, entries);
  }, [form.ref, entries]);

  const canProceed = () => {
    if (step === 2) {
      if (isDuplicateRef) return false;
      if (voucherNumberingQuery.data?.autoGenerate === false && !form.ref?.trim()) return false;
      return parsedAmount !== null && parsedAmount > 0;
    }
    return true;
  };

  const handleSave = async (status: "draft" | "posted", recordAnother = false) => {
    if (isSubmitting || inFlightRef.current) return;
    setSubmitError(null);
    const userRef = form.ref ? form.ref.trim() : "";
    if (userRef && !isJournalRefUnique(userRef, entries)) {
      setSubmitError(t("accounting.journal.dashboard.wizard.errorRefDuplicate"));
      return;
    }
    const guardErrors = validateJournalPostingGuards(
      {
        id: sessionEntryIdRef.current,
        date: form.date,
        ref: form.ref ?? "",
        description: form.description ?? "",
        status,
        created_by: "",
        tags: form.tags ?? [],
        attachments: [],
        fiscal_year: form.fiscal_year ?? "",
        lines: [],
      } as DraftForm,
      {
        fiscalYears: fiscalYears ?? [],
        postingPeriods: postingPeriodsQuery.data ?? [],
        voucherAutoGenerate: voucherNumberingQuery.data?.autoGenerate,
      },
      t,
    );
    if (Object.keys(guardErrors).length > 0) {
      setSubmitError(Object.values(guardErrors)[0] ?? t("common.formPleaseFixErrors"));
      return;
    }
    const validation = validateWizardForm(form, accounts);
    if (!validation.ok) {
      setSubmitError(t(validation.errorKey));
      return;
    }
    if (!selectedType) {
      setSubmitError(t("accounting.journal.dashboard.wizard.errorSource"));
      return;
    }
    inFlightRef.current = true;
    setSubmittingStatus(recordAnother ? "posted_and_new" : status);
    try {
      const description = form.description.trim() || quickActionLabel(selectedType, t);
      const candidateTags =
        form.tags && form.tags.length > 0 ? form.tags : selectedType.tag ? [selectedType.tag] : [];
      const candidate: JournalEntry = {
        id: sessionEntryIdRef.current,
        ref: userRef,
        date: form.date,
        description,
        status,
        created_by: user?.name?.trim() || "system",
        tags: candidateTags,
        attachments: [],
        fiscal_year: form.fiscal_year,
        fiscal_year_id: (fiscalYears || []).find(
          (year) => year.label === form.fiscal_year || year.id === form.fiscal_year,
        )?.id,
        simple_mode: true,
        transaction_type: selectedType.id,
        lines: [
          {
            id: generateClientEntityId("l", "-"),
            account_id: validation.debitAccount.id,
            debit: validation.amount,
            credit: 0,
            description,
          },
          {
            id: generateClientEntityId("l", "-"),
            account_id: validation.creditAccount.id,
            debit: 0,
            credit: validation.amount,
            description,
          },
        ],
      };

      const parsedEntry = journalEntryWriteSchema.safeParse(candidate);
      if (!parsedEntry.success || !isJournalEntryBalanced(parsedEntry.data.lines)) {
        setSubmitError(t("common.formPleaseFixErrors"));
        return;
      }
      const saved = await onSave(parsedEntry.data, recordAnother);
      if (recordAnother) {
        notify.success(
          `${saved?.ref || candidate.ref}: ${t("accounting.journal.dashboard.wizard.postMessage")}`,
        );
        // A "post and new" iteration is a new economic event: new identity.
        sessionEntryIdRef.current = generateClientEntityId("je");
        setForm((prev) => ({
          ...prev,
          amount: "",
          ref: "",
          description: quickActionDescription(selectedType, t),
        }));
        setAmountTouched(false);
        setStep(2);
      }
    } catch (error) {
      setSubmitError(
        mapApiFormError(error, (message) => translateApiMessage(message, t)).message ??
          t("accounting.settings.saveEntriesFailed"),
      );
    } finally {
      inFlightRef.current = false;
      setSubmittingStatus(null);
    }
  };

  return {
    step,
    setStep,
    selectedType,
    showAdvanced,
    setShowAdvanced,
    amountTouched,
    setAmountTouched,
    submittingStatus,
    isSubmitting,
    submitError,
    isDuplicateRef,
    voucherAutoGenerate: voucherNumberingQuery.data?.autoGenerate,
    form,
    setForm,
    stepSubtitle,
    handleTypeSelect,
    canProceed,
    handleSave,
  };
}
