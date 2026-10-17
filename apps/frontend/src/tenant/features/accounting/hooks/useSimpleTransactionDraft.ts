import { useEffect, useRef, useState } from "react";
import type { Account, FiscalYear } from "@/lib/data/accountingData";
import { resolveDefaultFiscalYear, todayISO, type AppTranslationKey } from "@mms/shared";
import { notify } from "@/lib/notify";
import {
  buildWizardFormState,
  resolveSimpleTransactionAccounts,
  TRANSACTION_GROUPS,
  type QuickActionType,
  type TransactionGroup,
  type WizardFormState,
} from "../lib/simpleTransactionWizardTypes";
import { quickActionDescription } from "../lib/quickActionLabels";

export const LAST_TYPE_SESSION_KEY = "mms-wizard-last-type-id";

export interface UseSimpleTransactionDraftParams {
  open: boolean;
  accounts: Account[];
  fiscalYears: FiscalYear[];
  prefillType?: QuickActionType | null;
  prefillAmount?: string;
  prefillDescription?: string;
  t: (key: AppTranslationKey) => string;
  /** Type groups on offer (entry templates or the built-in set); restores the last-used type from these. */
  transactionGroups?: readonly TransactionGroup[];
}

export function useSimpleTransactionDraft({
  open,
  accounts,
  fiscalYears,
  prefillType,
  prefillAmount,
  prefillDescription,
  t,
  transactionGroups = TRANSACTION_GROUPS,
}: UseSimpleTransactionDraftParams) {
  const activeFiscalYearLabel =
    resolveDefaultFiscalYear(fiscalYears, todayISO())?.label || "";
  const [step, setStep] = useState(() => (prefillType ? 2 : 1));
  const [selectedType, setSelectedType] = useState<QuickActionType | null>(prefillType || null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);

  const [form, setForm] = useState<WizardFormState>(() =>
    buildWizardFormState(
      prefillType ?? null,
      accounts,
      { date: todayISO(), fiscalYearLabel: activeFiscalYearLabel },
      (key) => t(key),
      { amount: prefillAmount, description: prefillDescription },
    ),
  );

  const resetContextRef = useRef({
    accounts,
    fiscalYearLabel: activeFiscalYearLabel,
    translate: (key: AppTranslationKey) => t(key) as string,
    transactionGroups,
  });
  useEffect(() => {
    resetContextRef.current = {
      accounts,
      fiscalYearLabel: activeFiscalYearLabel,
      translate: (key: AppTranslationKey) => t(key) as string,
      transactionGroups,
    };
  });

  const wasOpenRef = useRef(false);
  const draftRef = useRef<{
    form: WizardFormState;
    type: QuickActionType | null;
    closedAt: number;
  } | null>(null);
  const formRef = useRef(form);
  const selectedTypeRef = useRef(selectedType);
  useEffect(() => {
    formRef.current = form;
  });
  useEffect(() => {
    selectedTypeRef.current = selectedType;
  });

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const {
        accounts: liveAccounts,
        fiscalYearLabel,
        translate,
        transactionGroups: liveGroups,
      } = resetContextRef.current;

      const draft = draftRef.current;
      if (
        !prefillType &&
        draft &&
        draft.form.amount.trim() !== "" &&
        Date.now() - draft.closedAt < 30_000
      ) {
        const snapForm = draft.form;
        const snapType = draft.type;
        notify.archivedWithUndo(
          t("accounting.journal.dashboard.wizard.restoreDraft"),
          () => {
            if (snapType) {
              setSelectedType(snapType);
              setStep(2);
            }
            setForm(snapForm);
          },
          { undoLabel: t("accounting.journal.dashboard.wizard.restoreAction"), duration: 8000 },
        );
      }
      draftRef.current = null;

      setStep(prefillType ? 2 : 1);
      setSelectedType(prefillType ?? null);
      setShowAdvanced(false);
      setAmountTouched(false);

      let lastType: QuickActionType | null = null;
      if (!prefillType) {
        try {
          const lastId = sessionStorage.getItem(LAST_TYPE_SESSION_KEY);
          if (lastId) {
            for (const group of liveGroups) {
              const item = group.items.find((i) => i.id === lastId);
              if (item) {
                lastType = { ...item, groupKey: group.groupKey, color: group.color };
                break;
              }
            }
          }
        } catch {
          /* sessionStorage unavailable */
        }
      }

      setForm(
        buildWizardFormState(
          prefillType ?? lastType,
          liveAccounts,
          { date: todayISO(), fiscalYearLabel },
          translate,
          { amount: prefillAmount, description: prefillDescription },
        ),
      );
      if (lastType && !prefillType) {
        setSelectedType(lastType);
      }
    } else if (!open && wasOpenRef.current) {
      if (formRef.current.amount.trim() !== "") {
        draftRef.current = {
          form: formRef.current,
          type: selectedTypeRef.current,
          closedAt: Date.now(),
        };
      }
    }
    wasOpenRef.current = open;
  }, [open, prefillType, prefillAmount, prefillDescription, t]);

  const handleTypeSelect = (type: QuickActionType, advance: boolean) => {
    setSelectedType(type);
    setForm((previousForm) => ({
      ...previousForm,
      ...resolveSimpleTransactionAccounts(type, accounts),
      description: quickActionDescription(type, t),
      tags: type.tag ? [type.tag] : [],
    }));
    try {
      sessionStorage.setItem(LAST_TYPE_SESSION_KEY, type.id);
    } catch {
      /* ignore */
    }
    if (advance) setStep(2);
  };

  return {
    step,
    setStep,
    selectedType,
    setSelectedType,
    showAdvanced,
    setShowAdvanced,
    amountTouched,
    setAmountTouched,
    form,
    setForm,
    handleTypeSelect,
    activeFiscalYearLabel,
  };
}
