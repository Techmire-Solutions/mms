import { useMemo, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  isJournalRefUnique,
  type Account,
  type FiscalYear,
  type JournalEntry,
} from "@/lib/data/accountingData";
import {
  calculateAccountBalanceCents,
  wizardAccountOptions,
  wizardCategoryAccountOptions,
  type QuickActionType,
  type WizardFormState,
} from "../lib/simpleTransactionWizardTypes";
import { parseMoneyInput } from "../lib/simpleTransactionMoney";

interface UseSimpleTransactionStepFormStateParams {
  type: QuickActionType;
  form: WizardFormState;
  accounts: Account[];
  currencySymbol: string;
  fiscalYears?: FiscalYear[];
  entries?: readonly JournalEntry[];
  formatCurrency?: (amount: number | string | null | undefined) => string;
  idPrefix?: string;
  amountTouchedProp?: boolean;
  onAmountTouched?: () => void;
}

export function useSimpleTransactionStepFormState({
  type,
  form,
  accounts,
  currencySymbol,
  fiscalYears,
  entries,
  formatCurrency,
  idPrefix,
  amountTouchedProp,
  onAmountTouched,
}: UseSimpleTransactionStepFormStateParams) {
  const { t } = useTranslation();
  const prefix = idPrefix ?? "wizard";

  const [localAmountTouched, setLocalAmountTouched] = useState(false);
  const amountTouched = amountTouchedProp ?? localAmountTouched;
  const markAmountTouched = () => {
    setLocalAmountTouched(true);
    onAmountTouched?.();
  };

  const isMoneyIn = type.groupKey === "accounting.journal.dashboard.group.moneyIn";
  const isTransfer = type.groupKey === "accounting.journal.dashboard.group.transfers";
  const showFiscalYear = (fiscalYears ?? []).length > 1;

  const accountOptions = useMemo(
    () =>
      wizardAccountOptions(
        accounts,
        entries,
        formatCurrency ? (amount) => formatCurrency(amount) : undefined,
      ),
    [accounts, entries, formatCurrency],
  );
  const revenueOptions = useMemo(
    () => wizardCategoryAccountOptions(accounts, "Revenue"),
    [accounts],
  );
  const expenseOptions = useMemo(
    () => wizardCategoryAccountOptions(accounts, "Expense"),
    [accounts],
  );
  const fiscalYearOptions = useMemo(
    () =>
      (fiscalYears || []).map((fiscalYear) => ({
        value: fiscalYear.label,
        label: fiscalYear.label,
      })),
    [fiscalYears],
  );

  const amountIsEmpty = form.amount.trim() === "";
  const parsedAmount = parseMoneyInput(form.amount);
  const isTypingDecimal = form.amount.endsWith(".") || form.amount.endsWith(",");
  const amountIsInvalid =
    !amountIsEmpty && !isTypingDecimal && (parsedAmount === null || parsedAmount <= 0);
  const isSameAccount = Boolean(
    form.debitAcc && form.creditAcc && form.debitAcc === form.creditAcc,
  );
  const currencyPaddingClass =
    currencySymbol.length > 2 ? "ps-14" : currencySymbol.length > 1 ? "ps-11" : "ps-8";

  const isDuplicateRef = useMemo(() => {
    const trimmed = form.ref ? form.ref.trim() : "";
    if (!trimmed || !entries) return false;
    return !isJournalRefUnique(trimmed, entries);
  }, [form.ref, entries]);

  const moneyLegAccountId = isMoneyIn ? form.debitAcc : form.creditAcc;
  const moneyLegBalanceCents = useMemo(
    () =>
      moneyLegAccountId && entries
        ? calculateAccountBalanceCents(moneyLegAccountId, entries)
        : null,
    [moneyLegAccountId, entries],
  );
  const showLowBalanceWarning =
    !isMoneyIn && moneyLegBalanceCents !== null && moneyLegBalanceCents <= 0;

  const leg1 = isMoneyIn
    ? {
        id: `${prefix}-acc-in`,
        label: t("accounting.journal.dashboard.wizard.receivedInto"),
        field: "debitAcc" as const,
        options: accountOptions,
      }
    : isTransfer
      ? {
          id: `${prefix}-acc-from`,
          label: t("accounting.journal.dashboard.wizard.transferFrom"),
          field: "creditAcc" as const,
          options: accountOptions,
        }
      : {
          id: `${prefix}-acc-out`,
          label: t("accounting.journal.dashboard.wizard.paidFrom"),
          field: "creditAcc" as const,
          options: accountOptions,
        };

  const leg2 = isMoneyIn
    ? {
        id: `${prefix}-acc-category-in`,
        label: t("accounting.journal.dashboard.wizard.incomeCategory"),
        field: "creditAcc" as const,
        options: revenueOptions,
      }
    : isTransfer
      ? {
          id: `${prefix}-acc-to`,
          label: t("accounting.journal.dashboard.wizard.transferTo"),
          field: "debitAcc" as const,
          options: accountOptions,
        }
      : {
          id: `${prefix}-acc-category-out`,
          label: t("accounting.journal.dashboard.wizard.expenseCategory"),
          field: "debitAcc" as const,
          options: expenseOptions,
        };

  return {
    t,
    prefix,
    amountTouched,
    markAmountTouched,
    showFiscalYear,
    fiscalYearOptions,
    amountIsInvalid,
    isSameAccount,
    currencyPaddingClass,
    isDuplicateRef,
    showLowBalanceWarning,
    leg1,
    leg2,
  };
}
