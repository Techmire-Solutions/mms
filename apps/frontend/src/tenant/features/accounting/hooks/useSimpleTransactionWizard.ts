import { useMemo, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { isJournalRefUnique, type JournalEntry } from "@/lib/data/accountingData";
import {
  generateClientEntityId,
  isJournalEntryBalanced,
  journalEntryRecordSchema,
} from "@mms/shared";
import { notify } from "@/lib/notify";
import { validateWizardForm } from "./simpleTransactionWizardTypes";
import { parseMoneyInput } from "./simpleTransactionMoney";
import { quickActionDescription, quickActionLabel } from "./quickActionLabels";
import type { JournalEntrySave } from "./journalEntriesTypes";
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
  const isSubmitting = submittingStatus !== null;

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
      return parsedAmount !== null && parsedAmount > 0;
    }
    return true;
  };

  const handleSave = async (status: "draft" | "posted", recordAnother = false) => {
    if (isSubmitting) return;
    const userRef = form.ref ? form.ref.trim() : "";
    if (userRef && !isJournalRefUnique(userRef, entries)) {
      notify.error(t("accounting.journal.dashboard.wizard.errorRefDuplicate"));
      return;
    }
    const validation = validateWizardForm(form, accounts);
    if (!validation.ok) {
      notify.error(t(validation.errorKey));
      return;
    }
    if (!selectedType) {
      notify.error(t("accounting.journal.dashboard.wizard.errorSource"));
      return;
    }
    setSubmittingStatus(recordAnother ? "posted_and_new" : status);
    try {
      const description = form.description.trim() || quickActionLabel(selectedType, t);
      const candidateTags =
        form.tags && form.tags.length > 0 ? form.tags : selectedType.tag ? [selectedType.tag] : [];
      const candidate: JournalEntry = {
        id: generateClientEntityId("je"),
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

      const parsedEntry = journalEntryRecordSchema.safeParse(candidate);
      if (!parsedEntry.success || !isJournalEntryBalanced(parsedEntry.data.lines)) {
        notify.error(t("common.formPleaseFixErrors"));
        return;
      }
      const saved = await onSave(parsedEntry.data, recordAnother);
      if (recordAnother) {
        notify.success(
          `${saved?.ref || candidate.ref}: ${t("accounting.journal.dashboard.wizard.postMessage")}`,
        );
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
      notify.error(
        error instanceof Error ? error.message : t("accounting.settings.saveEntriesFailed"),
      );
    } finally {
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
    isDuplicateRef,
    form,
    setForm,
    stepSubtitle,
    handleTypeSelect,
    canProceed,
    handleSave,
  };
}
